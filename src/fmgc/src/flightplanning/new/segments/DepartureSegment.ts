// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Database, Departure, ExternalBackend } from 'msfs-navdata';
import { FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { FlightPlan } from '../plans/FlightPlan';

export class DepartureSegment extends FlightPlanSegment {
    class = SegmentClass.Departure

    originDeparture: Departure

    allLegs: FlightPlanLeg[] = []

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    async setDepartureProcedure(procedureIdent: string | undefined) {
        if (procedureIdent === undefined) {
            this.originDeparture = undefined;
            this.allLegs.length = 0;

            await this.flightPlan.departureRunwayTransitionSegment.setOriginRunwayTransitionSegment(undefined, []);
            await this.flightPlan.setDepartureEnrouteTransition(undefined);
            await this.flightPlan.originSegment.refreshOriginLegs();

            return;
        }

        const db = new Database(new ExternalBackend('http://localhost:5000'));

        if (!this.flightPlan.originAirport || !this.flightPlan.originRunway) {
            throw new Error('[FMS/FPM] Cannot set departure procedure without origin airport and runway');
        }

        const proceduresAtAirport = await db.getDepartures(this.flightPlan.originAirport.ident);

        if (proceduresAtAirport.length === 0) {
            throw new Error(`[FMS/FPM] Cannot find procedures at ${this.flightPlan.originAirport.ident}`);
        }

        const matchingProcedure = proceduresAtAirport.find((proc) => proc.ident === procedureIdent);

        if (!matchingProcedure) {
            throw new Error(`[FMS/FPM] Can't find procedure '${procedureIdent}' for ${this.flightPlan.originAirport.ident}`);
        }

        const runwayTransition = matchingProcedure.runwayTransitions.find((transition) => transition.ident === this.flightPlan.originRunway.ident);

        this.originDeparture = matchingProcedure;

        this.allLegs = matchingProcedure.commonLegs.map((leg) => FlightPlanLeg.fromProcedureLeg(this, leg, matchingProcedure.ident));
        this.strung = false;

        const mappedRunwayTransitionLegs = runwayTransition?.legs?.map((leg) => FlightPlanLeg.fromProcedureLeg(this, leg, matchingProcedure.ident)) ?? [];
        await this.flightPlan.departureRunwayTransitionSegment.setOriginRunwayTransitionSegment(runwayTransition, mappedRunwayTransitionLegs);

        this.flightPlan.stringSegmentsForwards(this.flightPlan.previousSegment(this), this);
        const nextSegment = this.flightPlan.nextSegment(this);
        if (nextSegment) {
            this.flightPlan.stringSegmentsForwards(this, nextSegment);
        }

        this.insertNecessaryDiscontinuities();
    }

    clone(forPlan: BaseFlightPlan): DepartureSegment {
        const newSegment = new DepartureSegment(forPlan);

        newSegment.allLegs = [...this.allLegs];
        newSegment.originDeparture = this.originDeparture;

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
    }

    removeAfter(_from: number) {
    }

    removeBefore(_before: number) {
    }
}
