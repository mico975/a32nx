// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Airport, Database, ExternalBackend, Runway } from 'msfs-navdata';
import { FlightPlanElement, FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { loadAllApproaches, loadAllArrivals, loadAllRunways } from '@fmgc/flightplanning/new/DataLoading';
import { FlightPlanSegment } from './FlightPlanSegment';

export class DestinationSegment extends FlightPlanSegment {
    class = SegmentClass.Arrival

    allLegs: FlightPlanElement[] = []

    private airport: Airport;

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    public get destinationAirport() {
        return this.airport;
    }

    public async setDestinationIcao(icao: string) {
        const db = new Database(new ExternalBackend('http://localhost:5000'));

        const airports = await db.getAirports([icao]);
        const airport = airports.find((a) => a.ident === icao);

        if (!airport) {
            throw new Error(`[FMS/FPM] Can't find airport with ICAO '${icao}'`);
        }

        this.airport = airport;

        this.flightPlan.availableDestinationRunways = await loadAllRunways(this.destinationAirport);

        await this.refreshDestinationLegs();

        this.flightPlan.availableArrivals = await loadAllArrivals(this.destinationAirport);
        this.flightPlan.availableApproaches = await loadAllApproaches(this.destinationAirport);
    }

    private runway?: Runway;

    public get destinationRunway() {
        return this.runway;
    }

    public async setDestinationRunway(runwayIdent: string) {
        const db = new Database(new ExternalBackend('http://localhost:5000'));

        if (!this.airport) {
            throw new Error('[FMS/FPM] Cannot set origin runway without origin airport');
        }

        const runways = await db.getRunways(this.airport.ident);

        const matchingRunway = runways.find((runway) => runway.ident === runwayIdent);

        if (!matchingRunway) {
            throw new Error(`[FMS/FPM] Can't find runway '${runwayIdent}' at ${this.airport.ident}`);
        }

        this.runway = matchingRunway;

        await this.refreshDestinationLegs();
    }

    private async refreshDestinationLegs() {
        this.allLegs.length = 0;

        const planHasApproach = this.flightPlan.approachSegment.allLegs.length > 0;

        if (planHasApproach) {
            return;
        }

        if (this.airport) {
            const approachName = this.flightPlan.approachSegment.approachProcedure?.ident ?? '';

            this.allLegs.push(FlightPlanLeg.fromAirportAndRunway(this, approachName, this.airport, this.runway));
        }

        this.flightPlan.availableApproaches = await loadAllApproaches(this.destinationAirport);
    }

    clone(forPlan: BaseFlightPlan): DestinationSegment {
        const newSegment = new DestinationSegment(forPlan);

        newSegment.airport = this.airport;
        newSegment.runway = this.runway;

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
        throw new Error('Not implemented');
    }

    removeAfter(_from: number) {
        throw new Error('Not implemented');
    }

    removeBefore(_before: number) {
        throw new Error('Not implemented');
    }
}
