// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import fetch from 'node-fetch';

import { loadSingleWaypoint } from '@fmgc/flightplanning/new/segments/enroute/WaypointLoading';
import { loadAirwayLegs } from '@fmgc/flightplanning/new/segments/enroute/AirwayLoading';
import { FlightPlan } from '@fmgc/flightplanning/new/plans/FlightPlan';
import { assertNotDiscontinuity } from '@fmgc/flightplanning/new/test/LegUtils';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

describe('a flight plan', () => {
    it('should truncate departure segment after it is edited', async () => {
        const flightPlan = FlightPlan.empty();

        await flightPlan.setOriginAirport('CYYZ');
        await flightPlan.setOriginRunway('RW06R');
        await flightPlan.setDeparture('AVSEP6');

        flightPlan.removeElementAt(4);

        expect(flightPlan.departureRunwayTransitionSegment.allLegs).toHaveLength(4);

        const lastLegOfTruncatedDeparture = assertNotDiscontinuity(flightPlan.departureRunwayTransitionSegment.allLegs[3]);
        expect(lastLegOfTruncatedDeparture.ident).toEqual('DUVKO');

        expect(flightPlan.departureSegment.allLegs).toHaveLength(0);

        expect(flightPlan.departureEnrouteTransitionSegment.allLegs).toHaveLength(0);

        expect(flightPlan.enrouteSegment.allLegs).toHaveLength(3);

        const firstLegOfEnroute = assertNotDiscontinuity(flightPlan.enrouteSegment.allLegs[0]);
        expect(firstLegOfEnroute.ident).toEqual('AVSEP');
    });

    it('should collapse waypoints within one segment', async () => {
        const flightPlan = FlightPlan.empty();
        const segment = flightPlan.enrouteSegment;

        const w1 = await loadSingleWaypoint('NOSUS', 'WCYCYULNOSUS');
        const w2 = await loadSingleWaypoint('NAPEE', 'WCY    NAPEE');
        const w3 = await loadSingleWaypoint('PBERG', 'WK6    PBERG');
        const w4 = await loadSingleWaypoint('HOVOB', 'WK6    HOVOB');

        segment.insertWaypoint(w1);
        segment.insertWaypoint(w2);
        segment.insertWaypoint(w3);
        segment.insertWaypoint(w4);

        const l1 = assertNotDiscontinuity(segment.allLegs[0]);
        const l2 = assertNotDiscontinuity(segment.allLegs[1]);
        const l3 = assertNotDiscontinuity(segment.allLegs[2]);
        const l4 = assertNotDiscontinuity(segment.allLegs[3]);

        expect(l1.ident).toEqual('NOSUS');
        expect(l2.ident).toEqual('NAPEE');
        expect(l3.ident).toEqual('PBERG');
        expect(l4.ident).toEqual('HOVOB');

        flightPlan.insertWaypointAfter(0, w4);

        expect(flightPlan.allLegs).toHaveLength(2);
        expect(l2.ident).toEqual('HOVOB');
    });

    it('should collapse waypoints across segments', async () => {
        const flightPlan = FlightPlan.empty();
        const departure = flightPlan.departureSegment;

        await flightPlan.setOriginAirport('NZQN');
        await flightPlan.setOriginRunway('RW05');
        await departure.setDepartureProcedure('ANPO3A');

        await departure.setDepartureEnrouteTransition('SAVLA');

        const enroute = flightPlan.enrouteSegment;

        const airwayLegs = await loadAirwayLegs('Y569', 'ENZ    Y569', 'WNZ    SAVLA', 'WNZ   PEDPO');

        enroute.insertLegs(...airwayLegs);

        console.log(flightPlan.allLegs.map((leg) => leg.ident).join('\n'));

        expect(flightPlan.allLegs).toHaveLength(13);

        const w1 = await loadSingleWaypoint('PEDPO', 'WNZ    PEDPO');

        flightPlan.insertWaypointAfter(4, w1);

        expect(flightPlan.allLegs).toHaveLength(6);
        expect(flightPlan.departureSegment.allLegs[flightPlan.departureSegment.allLegs.length - 1].ident).toEqual('LEMAK');
        expect(flightPlan.enrouteSegment.allLegs[0].ident).toEqual('PEDPO');
    });

    it('should restring the departure to the enroute after inserting the last waypoint of the departure in the enroute', async () => {
        const flightPlan = FlightPlan.empty();

        await flightPlan.setOriginAirport('NZCH');
        await flightPlan.setOriginRunway('RW02');
        await flightPlan.departureSegment.setDepartureProcedure('BAVE6P');

        expect(flightPlan.departureSegment.allLegs[flightPlan.departureSegment.allLegs.length - 1].ident).toEqual('BAVEM');

        const w1 = await loadSingleWaypoint('BAVEM', 'WNZNZCHBAVEM');

        await flightPlan.enrouteSegment.insertWaypoint(w1);

        expect(flightPlan.departureSegment.allLegs[flightPlan.departureSegment.allLegs.length - 1].ident).toEqual('RINKO');
    });
});
