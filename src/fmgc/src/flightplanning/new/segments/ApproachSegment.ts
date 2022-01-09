// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Approach, Database, ExternalBackend, WaypointDescriptor } from 'msfs-navdata';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { FlightPlanElement, FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { FlightPlan } from '@fmgc/flightplanning/new/plans/FlightPlan';

export class ApproachSegment extends FlightPlanSegment {
    class = SegmentClass.Arrival

    allLegs: FlightPlanElement[] = []

    private approach: Approach | undefined

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    get approachProcedure() {
        return this.approach;
    }

    async setApproachProcedure(procedureIdent: string | undefined) {
        const db = new Database(new ExternalBackend('http://localhost:5000'));

        if (procedureIdent === undefined) {
            this.flightPlan.approachViaSegment.setApproachVia(undefined);
            this.approach = undefined;
            this.allLegs = this.createLegSet([]);
            return;
        }

        const { destinationAirport } = this.flightPlan.destinationSegment;

        if (!destinationAirport) {
            throw new Error('[FMS/FPM] Cannot set approach without destination airport');
        }

        const approaches = await db.getApproaches(destinationAirport.ident);

        const matchingProcedure = approaches.find((approach) => approach.ident === procedureIdent);

        if (!matchingProcedure) {
            throw new Error(`[FMS/FPM] Can't find approach procedure '${procedureIdent}' for ${destinationAirport.ident}`);
        }

        this.approach = matchingProcedure;
        this.allLegs = this.createLegSet(matchingProcedure.legs.map((leg) => FlightPlanLeg.fromProcedureLeg(this, leg, matchingProcedure.ident)));
        this.strung = false;

        const mappedMissedApproachLegs = matchingProcedure.missedLegs.map((leg) => FlightPlanLeg.fromProcedureLeg(this.flightPlan.missedApproachSegment, leg, matchingProcedure.ident));
        this.flightPlan.missedApproachSegment.setMissedApproachLegs(mappedMissedApproachLegs);

        this.flightPlan.stringSegmentsForwards(this.flightPlan.previousSegment(this), this);
        this.insertNecessaryDiscontinuities();
    }

    onRunwaySelectedWithoutApproach() {

    }

    createLegSet(approachLegs: FlightPlanElement[]): FlightPlanElement[] {
        const legs = [];

        const airport = this.flightPlan.destinationAirport;
        const runway = this.flightPlan.destinationRunway;

        if (approachLegs.length === 0 && this.flightPlan.destinationAirport && this.flightPlan.destinationSegment.destinationRunway) {
            const cf = FlightPlanLeg.destinationExtendedCenterline(
                this,
                this.flightPlan.destinationSegment.destinationAirport,
                this.flightPlan.destinationSegment.destinationRunway,
            );

            legs.push(cf);
            legs.push(FlightPlanLeg.fromAirportAndRunway(this, airport, runway));
        } else {
            legs.push(...approachLegs.slice(0, approachLegs.length - 1));

            const lastLeg = approachLegs[approachLegs.length - 1];

            if (lastLeg?.isDiscontinuity === false && lastLeg.waypointDescriptor === WaypointDescriptor.Runway) {
                const mappedLeg = FlightPlanLeg.fromAirportAndRunway(this, this.approachProcedure?.ident ?? '', airport, runway);

                legs.push(mappedLeg);
            }
        }

        return legs;
    }

    clone(forPlan: BaseFlightPlan): ApproachSegment {
        const newSegment = new ApproachSegment(forPlan);

        newSegment.allLegs = [...this.allLegs];
        newSegment.approach = this.approach;

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
    }

    removeAfter(_from: number) {
    }

    removeBefore(_before: number) {
    }
}
