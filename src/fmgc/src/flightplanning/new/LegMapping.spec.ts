// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import fetch from 'node-fetch';
import { FlightPlan } from '@fmgc/flightplanning/new/FlightPlan';
import { LegType, ProcedureLeg } from 'msfs-navdata';
import { procedureLegToLeg } from '@fmgc/flightplanning/new/LegMapping';
import { SegmentType } from '@fmgc/flightplanning/FlightPlanSegment';
import { CALeg } from '@fmgc/guidance/lnav/legs/CA';
import { TFLeg } from '@fmgc/guidance/lnav/legs/TF';
import { Leg } from '@fmgc/guidance/lnav/legs/Leg';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

describe('leg mapping', () => {
    it('can map NZCH02 BAVE6P correctly', async () => {
        const flightPlan = FlightPlan.empty();
        const segment = flightPlan.departureSegment;

        await flightPlan.setOriginAirport('NZCH');
        await flightPlan.setOriginRunway('RW02');
        await segment.setDepartureProcedure('BAVE6P');

        // TF to DER02

        const tfLeg = segment.allLegs[0];

        expect(tfLeg.type).toEqual(LegType.DF);

        const mappedTfLeg = procedureLegToLeg(undefined, tfLeg, SegmentType.Departure);

        expect(mappedTfLeg).toBeInstanceOf(TFLeg);

        // CA to 500FT

        const caLeg = segment.allLegs[1];

        expect(caLeg.type).toEqual(LegType.CA);

        const mappedCaLeg = procedureLegToLeg(undefined, caLeg, SegmentType.Departure);

        expect(mappedCaLeg).toBeInstanceOf(CALeg);
        expect(mappedCaLeg).toEqual(
            expect.objectContaining({ course: caLeg.trueCourse, altitude: 500 } as Partial<CALeg>),
        );
    });
});
