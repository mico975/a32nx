// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import fetch from 'node-fetch';
import { FlightPlanService } from '@fmgc/flightplanning/new/FlightPlanService';
import { FlightPlanIndex } from '@fmgc/flightplanning/new/FlightPlanManager';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

describe('the flight plan service', () => {
    it('deletes the temporary flight plan properly', async () => {
        await FlightPlanService.newCityPair('CYUL', 'LOWI', 'LOWG');

        await FlightPlanService.setOriginRunway('RW06R');

        FlightPlanService.temporaryDelete();

        expect(FlightPlanService.hasTemporary).toBeFalsy();
        expect(FlightPlanService.activeOrTemporary.originRunway).toBeUndefined();
    });

    it('inserts the temporary flight plan properly', async () => {
        await FlightPlanService.newCityPair('CYUL', 'LOWI', 'LOWG');

        await FlightPlanService.setOriginRunway('RW06R');

        FlightPlanService.temporaryInsert();

        expect(FlightPlanService.hasTemporary).toBeFalsy();
        expect(FlightPlanService.activeOrTemporary.originRunway).toEqual(expect.objectContaining({ ident: 'RW06R' }));
    });

    describe('editing the active flight plan', () => {
        it('correctly accepts a city pair', async () => {
            await FlightPlanService.newCityPair('CYUL', 'LOWI', 'LOWG');

            expect(FlightPlanService.hasTemporary).toBeFalsy();

            expect(FlightPlanService.activeOrTemporary.originAirport).toEqual(expect.objectContaining({ ident: 'CYUL' }));
            expect(FlightPlanService.activeOrTemporary.destinationAirport).toEqual(expect.objectContaining({ ident: 'LOWI' }));
            expect(FlightPlanService.activeOrTemporary.alternateDestinationAirport).toEqual(expect.objectContaining({ ident: 'LOWG' }));
        });

        it('does create a temporary flight plan when changing procedure details', async () => {
            await FlightPlanService.newCityPair('CYYZ', 'LGKR', 'LGKO');

            await FlightPlanService.setOriginRunway('RW06R');
            expect(FlightPlanService.hasTemporary).toBeTruthy();
            FlightPlanService.temporaryInsert();

            await FlightPlanService.setDepartureProcedure('AVSEP6');
            expect(FlightPlanService.hasTemporary).toBeTruthy();
            FlightPlanService.temporaryInsert();

            await FlightPlanService.setDepartureEnrouteTransition('OTNIK');
            expect(FlightPlanService.hasTemporary).toBeTruthy();
            FlightPlanService.temporaryInsert();

            await FlightPlanService.setDestinationRunway('RW34');
            expect(FlightPlanService.hasTemporary).toBeTruthy();
            FlightPlanService.temporaryInsert();

            await FlightPlanService.setArrival('PARA1J');
            expect(FlightPlanService.hasTemporary).toBeTruthy();
            FlightPlanService.temporaryInsert();

            await FlightPlanService.setApproach('R34');
            expect(FlightPlanService.hasTemporary).toBeTruthy();
            FlightPlanService.temporaryInsert();

            await FlightPlanService.setApproachVia('BEDEX');
            expect(FlightPlanService.hasTemporary).toBeTruthy();
            FlightPlanService.temporaryInsert();
        });
    });

    describe('editing a secondary flight plan', () => {
        it('correctly accepts a city pair', async () => {
            await FlightPlanService.newCityPair('CYUL', 'LOWI', 'LOWG', FlightPlanIndex.FirstSecondary);

            expect(FlightPlanService.secondary(1).originAirport).toEqual(expect.objectContaining({ ident: 'CYUL' }));
            expect(FlightPlanService.secondary(1).destinationAirport).toEqual(expect.objectContaining({ ident: 'LOWI' }));
            expect(FlightPlanService.secondary(1).alternateDestinationAirport).toEqual(expect.objectContaining({ ident: 'LOWG' }));
        });

        it('does not create a temporary flight plan when changing procedure details', async () => {
            await FlightPlanService.newCityPair('CYYZ', 'LGKR', 'LGKO', FlightPlanIndex.FirstSecondary);

            await FlightPlanService.setOriginRunway('RW06R', FlightPlanIndex.FirstSecondary);
            expect(FlightPlanService.hasTemporary).toBeFalsy();

            await FlightPlanService.setDepartureProcedure('AVSEP6', FlightPlanIndex.FirstSecondary);
            expect(FlightPlanService.hasTemporary).toBeFalsy();

            await FlightPlanService.setDepartureEnrouteTransition('OTNIK', FlightPlanIndex.FirstSecondary);
            expect(FlightPlanService.hasTemporary).toBeFalsy();

            await FlightPlanService.setDestinationRunway('RW34', FlightPlanIndex.FirstSecondary);
            expect(FlightPlanService.hasTemporary).toBeFalsy();

            await FlightPlanService.setArrival('PARA1J', FlightPlanIndex.FirstSecondary);
            expect(FlightPlanService.hasTemporary).toBeFalsy();

            await FlightPlanService.setApproach('R34', FlightPlanIndex.FirstSecondary);
            expect(FlightPlanService.hasTemporary).toBeFalsy();

            await FlightPlanService.setApproachVia('BEDEX', FlightPlanIndex.FirstSecondary);
            expect(FlightPlanService.hasTemporary).toBeFalsy();
        });
    });
});
