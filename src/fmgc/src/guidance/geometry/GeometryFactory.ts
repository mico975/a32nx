// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Geometry, LnavConfig } from '@fmgc/guidance';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { Leg } from '@fmgc/guidance/lnav/legs/Leg';
import { Transition } from '@fmgc/guidance/lnav/Transition';
import { FlightPlanElement, FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { LegType } from 'msfs-navdata';
import { TFLeg } from '@fmgc/guidance/lnav/legs/TF';
import { SegmentType } from '@fmgc/flightplanning/FlightPlanSegment';
import { IFLeg } from '@fmgc/guidance/lnav/legs/IF';
import { CALeg } from '@fmgc/guidance/lnav/legs/CA';
import { AFLeg } from '@fmgc/guidance/lnav/legs/AF';
import { fixCoordinates } from '@fmgc/flightplanning/new/utils';
import { CFLeg } from '@fmgc/guidance/lnav/legs/CF';
import { CILeg } from '@fmgc/guidance/lnav/legs/CI';
import { TransitionPicker } from '@fmgc/guidance/lnav/TransitionPicker';
import { DFLeg } from '@fmgc/guidance/lnav/legs/DF';
import { legMetadataFromFlightPlanLeg } from '@fmgc/guidance/lnav/legs';
import { XFLeg } from '@fmgc/guidance/lnav/legs/XF';

export class GeometryFactory {
    private constructor() {
    }

    static createFromFlightPlan(plan: BaseFlightPlan, viewListener: ViewListener.ViewListener, doGenerateTransitions = true): Geometry {
        const legs = new Map<number, Leg>();
        const transitions = new Map<number, Transition>();

        const planElements = plan.allLegs;
        for (let i = 0; i < planElements.length; i++) {
            const prevElement = planElements[i - 1];
            const element = planElements[i];
            const nextElement = planElements[i + 1];

            if (element.isDiscontinuity === true) {
                continue;
            }

            let nextGeometryLeg;
            if (nextElement?.isDiscontinuity === false && nextElement.type !== LegType.CI && nextElement.type !== LegType.VI) {
                nextGeometryLeg = GeometryFactory.geometryLegFromFlightPlanLeg(element, nextElement);
            }

            const geometryLeg = GeometryFactory.geometryLegFromFlightPlanLeg(prevElement, element, nextGeometryLeg);

            const previousGeometryLwg = legs.get(i - 1);

            if (previousGeometryLwg && doGenerateTransitions) {
                const transition = TransitionPicker.forLegs(previousGeometryLwg, geometryLeg);

                transitions.set(i - 1, transition);
            }

            legs.set(i, geometryLeg);
        }

        return new Geometry(transitions, legs, viewListener);
    }

    static updateFromFlightPlan(geometry: Geometry, flightPlan: BaseFlightPlan) {
        if (LnavConfig.DEBUG_GEOMETRY) {
            console.log('[Fms/Geometry/Update] Starting geometry update.');
        }

        for (let i = flightPlan.activeLegIndex - 1; i < flightPlan.legCount; i++) {
            const oldLeg = geometry.legs.get(i);

            const previousPlanLeg = flightPlan.allLegs[i - 1];
            const nextPlanLeg = flightPlan.allLegs[i + 1];

            const planLeg = flightPlan.allLegs[i];

            let nextLeg: Leg;
            if (nextPlanLeg?.isDiscontinuity === false && nextPlanLeg.type !== LegType.CI) {
                nextLeg = this.geometryLegFromFlightPlanLeg(planLeg, nextPlanLeg);
            }

            const newLeg = planLeg?.isDiscontinuity === false ? this.geometryLegFromFlightPlanLeg(previousPlanLeg, planLeg, nextLeg) : undefined;

            if (LnavConfig.DEBUG_GEOMETRY) {
                console.log(`[FMS/Geometry/Update] Old leg #${i} = ${oldLeg?.repr ?? '<none>'}`);
                console.log(`[FMS/Geometry/Update] New leg #${i} = ${newLeg?.repr ?? '<none>'}`);
            }

            const legsMatch = oldLeg?.repr === newLeg?.repr;

            if (legsMatch) {
                if (LnavConfig.DEBUG_GEOMETRY) {
                    console.log('[FMS/Geometry/Update] Old and new leg are the same. Keeping old leg.');
                }

                // Sync fixes

                if (oldLeg instanceof XFLeg && newLeg instanceof XFLeg) {
                    oldLeg.fix = newLeg.fix;
                }

                const prevLeg = geometry.legs.get(i - 1);

                const oldInboundTransition = geometry.transitions.get(i - 1);
                const newInboundTransition = TransitionPicker.forLegs(prevLeg, newLeg);

                const transitionsMatch = oldInboundTransition?.repr === newInboundTransition?.repr;

                if (!transitionsMatch) {
                    geometry.transitions.set(i - 1, newInboundTransition);
                }
            } else {
                if (LnavConfig.DEBUG_GEOMETRY) {
                    if (!oldLeg) console.log('[FMS/Geometry/Update] No old leg. Adding new leg.');
                    else if (!newLeg) console.log('[FMS/Geometry/Update] No new leg. Removing old leg.');
                    else console.log('[FMS/Geometry/Update] Old and new leg are different. Keeping new leg.');
                }

                if (newLeg) {
                    geometry.legs.set(i, newLeg);

                    const prevLeg = geometry.legs.get(i - 1);

                    const computeAllTransitions = LnavConfig.NUM_COMPUTED_TRANSITIONS_AFTER_ACTIVE === -1;

                    if (prevLeg && (computeAllTransitions || (i - flightPlan.activeLegIndex) <= LnavConfig.NUM_COMPUTED_TRANSITIONS_AFTER_ACTIVE)) {
                        const newInboundTransition = TransitionPicker.forLegs(prevLeg, newLeg);

                        if (LnavConfig.DEBUG_GEOMETRY) {
                            console.log(`[FMS/Geometry/Update] Set new inbound transition for new leg (${newInboundTransition?.repr ?? '<none>'})`);
                        }

                        if (newInboundTransition) {
                            geometry.transitions.set(i - 1, newInboundTransition);
                        } else {
                            geometry.transitions.delete(i - 1);
                        }
                    } else {
                        geometry.transitions.delete(i - 1);
                    }
                } else {
                    geometry.legs.delete(i);
                    geometry.transitions.delete(i - 1);
                    geometry.transitions.delete(i);
                }
            }
        }

        // Trim geometry

        for (const [index] of geometry.legs.entries()) {
            const legBeforePrev = index < flightPlan.activeLegIndex - 1;
            const legAfterLastWpt = index >= flightPlan.legCount;

            if (legBeforePrev || legAfterLastWpt) {
                if (LnavConfig.DEBUG_GEOMETRY) {
                    console.log(`[FMS/Geometry/Update] Removed leg #${index} (${geometry.legs.get(index)?.repr ?? '<unknown>'}) because of trimming.`);
                }

                geometry.legs.delete(index);
                geometry.transitions.delete(index - 1);
            }
        }

        if (LnavConfig.DEBUG_GEOMETRY) {
            console.log('[Fms/Geometry/Update] Done with geometry update.');
        }
    }

    private static geometryLegFromFlightPlanLeg(previousFlightPlanLeg: FlightPlanElement | undefined, flightPlanLeg: FlightPlanLeg, nextGeometryLeg?: Leg): Leg {
        if (previousFlightPlanLeg?.isDiscontinuity === true && flightPlanLeg.type !== LegType.IF) {
            throw new Error('[FMS/Geometry] Cannot create non-IF geometry leg after discontinuity');
        }

        const editableData = legMetadataFromFlightPlanLeg(flightPlanLeg);

        switch (flightPlanLeg.type) {
        case LegType.AF: {
            const waypoint = flightPlanLeg.terminationWaypoint();
            const recommendedNavaid = flightPlanLeg.definition.recommendedNavaid;
            const navaid = 'vorLocation' in recommendedNavaid ? recommendedNavaid.vorLocation : recommendedNavaid.location;
            const rho = flightPlanLeg.definition.rho;
            const theta = flightPlanLeg.definition.theta;
            const course = flightPlanLeg.definition.magneticCourse;

            return new AFLeg(waypoint, fixCoordinates(navaid), rho, theta, course, editableData, SegmentType.Departure);
        }
        case LegType.CA:
        case LegType.FA: {
            const course = flightPlanLeg.definition.magneticCourse;
            const altitude = flightPlanLeg.definition.altitude1;

            return new CALeg(course, altitude, editableData, SegmentType.Departure);
        }
        case LegType.CD:
            break;
        case LegType.CF: {
            const fix = flightPlanLeg.terminationWaypoint();
            const course = flightPlanLeg.definition.magneticCourse;

            return new CFLeg(fix, course, editableData, SegmentType.Departure);
        }
        case LegType.CI: {
            const course = flightPlanLeg.definition.magneticCourse;

            if (!nextGeometryLeg) {
                throw new Error('[FMS/Geometry] Cannot make a CI leg without the next geometry leg being defined');
            }

            return new CILeg(course, nextGeometryLeg, editableData, SegmentType.Departure);
        }
        case LegType.CR:
            break;
        case LegType.DF: {
            const waypoint = flightPlanLeg.terminationWaypoint();

            return new DFLeg(waypoint, editableData, SegmentType.Departure);
        }
        // case LegType.FA:
        //     break;
        case LegType.FC:
            break;
        case LegType.FD:
            break;
        case LegType.FM:
            break;
        case LegType.HA:
            break;
        case LegType.HF:
            break;
        case LegType.HM:
            break;
        case LegType.IF: {
            const waypoint = flightPlanLeg.terminationWaypoint();

            return new IFLeg(waypoint, editableData, SegmentType.Departure);
        }
        case LegType.PI:
            break;
        case LegType.RF:
            break;
        case LegType.TF: {
            const prev = previousFlightPlanLeg as FlightPlanLeg;

            if (!prev.isXf()) {
                throw new Error('[FMS/Geometry] Cannot create a TF leg after a non-XF leg');
            }

            const prevWaypoint = prev.terminationWaypoint();
            const waypoint = flightPlanLeg.terminationWaypoint();

            return new TFLeg(prevWaypoint, waypoint, editableData, SegmentType.Departure);
        }
        case LegType.VA:
            break;
        case LegType.VD:
            break;
        case LegType.VI:
            break;
        case LegType.VM:
            break;
        case LegType.VR:
            break;
        default:
            break;
        }

        throw new Error(`[FMS/Geometry] Could not generate geometry leg for flight plan leg type=${LegType[flightPlanLeg.type]}`);
    }
}
