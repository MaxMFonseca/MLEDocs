import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { handbookPages } from '../../src/data/handbook';

export interface AudioContractRecord {
	readonly kind: 'command' | 'outcome' | 'type' | 'lua-callable' | 'lua-field' | 'runtime-config' | 'bus';
	readonly name: string;
	readonly ownerPageId: string;
}

interface AudioContractDiff {
	readonly missing: readonly string[];
	readonly extra: readonly string[];
	readonly discoveredDuplicates: readonly string[];
	readonly documentedDuplicates: readonly string[];
	readonly invalidOwners: readonly string[];
	readonly ownerDisagreements: readonly string[];
}

interface AudioSourceManifest {
	readonly mleCommit: string;
	readonly groups: readonly (Omit<AudioContractRecord, 'name'> & {
		readonly sourceFiles: readonly string[];
		readonly names: readonly string[];
	})[];
}

const keyOf = ({ kind, name }: Pick<AudioContractRecord, 'kind' | 'name'>) => `${kind}:${name}`;

export function compareAudioContracts(
	discovered: readonly AudioContractRecord[],
	documented: readonly AudioContractRecord[],
): AudioContractDiff {
	const discoveredKeys = new Set(discovered.map(keyOf));
	const documentedKeys = new Set(documented.map(keyOf));
	const discoveredCounts = new Map<string, number>();
	const documentedCounts = new Map<string, number>();
	for (const record of discovered) discoveredCounts.set(keyOf(record), (discoveredCounts.get(keyOf(record)) ?? 0) + 1);
	for (const record of documented) documentedCounts.set(keyOf(record), (documentedCounts.get(keyOf(record)) ?? 0) + 1);
	const validOwners = new Set(handbookPages.map(({ pageId }) => pageId));
	const discoveredOwners = new Map(discovered.map((record) => [keyOf(record), record.ownerPageId]));
	return {
		missing: [...discoveredKeys].filter((key) => !documentedKeys.has(key)).sort(),
		extra: [...documentedKeys].filter((key) => !discoveredKeys.has(key)).sort(),
		discoveredDuplicates: [...discoveredCounts].filter(([, count]) => count > 1).map(([key]) => key).sort(),
		documentedDuplicates: [...documentedCounts].filter(([, count]) => count > 1).map(([key]) => key).sort(),
		invalidOwners: documented.filter(({ ownerPageId }) => !validOwners.has(ownerPageId)).map(keyOf).sort(),
		ownerDisagreements: documented
			.filter((record) => discoveredOwners.has(keyOf(record)) && discoveredOwners.get(keyOf(record)) !== record.ownerPageId)
			.map(keyOf).sort(),
	};
}

const records = (kind: AudioContractRecord['kind'], ownerPageId: string, names: readonly string[]) =>
	names.map((name) => ({ kind, name, ownerPageId })) satisfies readonly AudioContractRecord[];

const sourceManifest = JSON.parse(
	readFileSync(new URL('../fixtures/audio-contract-source-manifest.json', import.meta.url), 'utf8'),
) as AudioSourceManifest;

const discoveredRecords: readonly AudioContractRecord[] = sourceManifest.groups.flatMap(({ kind, ownerPageId, names }) =>
	records(kind, ownerPageId, names));

// Deliberately repeated rather than aliased: source discovery and published ownership
// must be edited independently for a mismatch to become visible.
const documentedRecords: readonly AudioContractRecord[] = [
	...records('command', 'audio-contracts', [
		'Load', 'PlayOneShot', 'StartStream', 'StartStreamGroup', 'StopStream', 'SetStreamParams', 'PauseStream',
		'ResumeStream', 'SetVolume', 'SetListener', 'SetDistanceParams', 'StopAll', 'SetBusVoicePolicy',
	]),
	...records('outcome', 'audio-lifecycle-and-command-flow', [
		'CommandSubmitResult.ACCEPTED', 'CommandSubmitResult.FULL', 'CommandSubmitResult.CLOSED',
		'VoiceRejectReason.NONE', 'VoiceRejectReason.INVALID_BUS', 'VoiceRejectReason.ZERO_PRIORITY',
		'VoiceRejectReason.BUS_CAP', 'VoiceRejectReason.INSUFFICIENT_PRIORITY', 'VoiceRejectReason.NO_ELIGIBLE_VICTIM',
		'StreamGroupRejectReason.NONE', 'StreamGroupRejectReason.EMPTY', 'StreamGroupRejectReason.TOO_MANY',
		'StreamGroupRejectReason.INVALID_SLOT', 'StreamGroupRejectReason.DUPLICATE_SLOT',
	]),
	...records('outcome', 'playback-and-streaming', [
		'RampCompletion.NONE', 'RampCompletion.STOP',
	]),
	...records('type', 'audio-contracts', [
		'AudioEngine', 'PlayParams', 'Cmd', 'CommandMailbox', 'AudioThreadStartup', 'WavData', 'SourcePlaybackState',
		'SampleWindow', 'ValidatedStreamStart', 'VolumeRamp', 'RampCompletion', 'RampAdvance', 'BusVoicePolicy',
		'VoiceMetadata', 'VoiceSelection',
	]),
	...records('lua-callable', 'audio-contracts', [
		'C.Audio.loadSound', 'C.Audio.playOneShot', 'C.Audio.startStream', 'C.Audio.stopStream',
		'C.Audio.pauseStream', 'C.Audio.resumeStream', 'C.Audio.setStreamParams', 'C.Audio.setVolume',
		'C.Audio.getVolume', 'C.Audio.setBusVoicePolicy', 'C.Audio.stopAll',
	]),
	...records('lua-field', 'audio-contracts', [
		'loadSound.name', 'loadSound.stream', 'playOneShot.name', 'playOneShot.bus', 'playOneShot.volume',
		'playOneShot.pitch', 'playOneShot.priority', 'startStream.name', 'startStream.id', 'startStream.bus',
		'startStream.volume', 'startStream.pitch', 'startStream.looping', 'startStream.fade_in_ms',
		'setStreamParams.id', 'setStreamParams.volume', 'setStreamParams.pitch', 'setStreamParams.fade_ms',
		'setBusVoicePolicy.bus', 'setBusVoicePolicy.max_voices', 'setBusVoicePolicy.protected_from_other_buses',
	]),
	...records('runtime-config', 'audio-contracts', [
		'audio.play_one_shot', 'audio.start_stream', 'audio.stop_stream', 'audio.pause_stream',
		'audio.resume_stream', 'audio.set_volume', 'audio.stop_all',
	]),
	...records('bus', 'buses-voices-and-limitations', ['0 (master)', '1', '2', '3', '4', '5', '6', '7']),
];

describe('audio contract comparator', () => {
	it('loads an independently source-anchored clone-portable manifest', () => {
		expect(sourceManifest.mleCommit).toBe('c1abea3de165032fe064300340807b7a6af388f8');
		expect(discoveredRecords).toHaveLength(91);
		expect(discoveredRecords.map(keyOf)).toEqual(expect.arrayContaining([
			'outcome:RampCompletion.NONE',
			'outcome:RampCompletion.STOP',
			'type:RampCompletion',
			'type:RampAdvance',
		]));
		expect(Object.fromEntries(
			['command', 'outcome', 'type', 'lua-callable', 'lua-field', 'runtime-config', 'bus'].map((kind) => [
				kind,
				discoveredRecords.filter((record) => record.kind === kind).length,
			]),
		)).toEqual({ command: 13, outcome: 16, type: 15, 'lua-callable': 11, 'lua-field': 21, 'runtime-config': 7, bus: 8 });
		for (const group of sourceManifest.groups) {
			expect(group.sourceFiles.length).toBeGreaterThan(0);
			for (const sourceFile of group.sourceFiles) {
				expect(sourceFile).toMatch(/^(src\/mle\/audio)\/.+\.(?:h|cpp)$/);
				expect(sourceFile).not.toContain('.local');
			}
		}
	});

	it('reports zero gaps for the independently maintained pinned inventory', () => {
		expect(compareAudioContracts(discoveredRecords, documentedRecords)).toEqual({
			missing: [], extra: [], discoveredDuplicates: [], documentedDuplicates: [], invalidOwners: [], ownerDisagreements: [],
		});
	});

	it('detects missing and extra identities independently', () => {
		const first = keyOf(discoveredRecords[0]);
		expect(compareAudioContracts(discoveredRecords, documentedRecords.slice(1)).missing).toEqual([first]);
		expect(compareAudioContracts(discoveredRecords.slice(1), documentedRecords).extra).toEqual([first]);
	});

	it('detects duplicates on both sides', () => {
		const first = keyOf(discoveredRecords[0]);
		expect(compareAudioContracts([...discoveredRecords, discoveredRecords[0]], documentedRecords).discoveredDuplicates).toEqual([first]);
		expect(compareAudioContracts(discoveredRecords, [...documentedRecords, documentedRecords[0]]).documentedDuplicates).toEqual([first]);
	});

	it('detects invalid owners and owner swaps', () => {
		const invalid = documentedRecords.map((record, index) => index === 0 ? { ...record, ownerPageId: 'not-a-page' } : record);
		const swapped = documentedRecords.map((record, index) => index === 0 ? { ...record, ownerPageId: 'audio' } : record);
		expect(compareAudioContracts(discoveredRecords, invalid).invalidOwners).toEqual([keyOf(documentedRecords[0])]);
		expect(compareAudioContracts(discoveredRecords, swapped).ownerDisagreements).toEqual([keyOf(documentedRecords[0])]);
	});

	it('detects deletion and owner mutation against the source-anchored ramp contracts', () => {
		const withoutRampAdvance = documentedRecords.filter(({ name }) => name !== 'RampAdvance');
		expect(compareAudioContracts(discoveredRecords, withoutRampAdvance).missing).toContain('type:RampAdvance');
		const sourceManifestWithoutRampAdvance = discoveredRecords.filter(({ name }) => name !== 'RampAdvance');
		expect(compareAudioContracts(sourceManifestWithoutRampAdvance, documentedRecords).extra).toContain('type:RampAdvance');
		const swappedRampStop = documentedRecords.map((record) => record.name === 'RampCompletion.STOP'
			? { ...record, ownerPageId: 'audio-contracts' }
			: record);
		expect(compareAudioContracts(discoveredRecords, swappedRampStop).ownerDisagreements).toContain('outcome:RampCompletion.STOP');
	});

	it('keeps all contracts on the seven Task 6 owners', () => {
		const owners = new Set([
			'audio', 'audio-lifecycle-and-command-flow', 'playback-and-streaming', 'buses-voices-and-limitations',
			'use-audio-playback', 'audio-contracts', 'audio-test',
		]);
		for (const record of [...discoveredRecords, ...documentedRecords]) {
			expect(owners.has(record.ownerPageId), keyOf(record)).toBe(true);
			expect(handbookPages.some(({ pageId }) => pageId === record.ownerPageId), record.ownerPageId).toBe(true);
		}
	});
});
