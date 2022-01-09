// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Leg } from '@fmgc/guidance/lnav/legs/Leg';
import { LegType, ProcedureLeg, Waypoint } from 'msfs-navdata';
import { TFLeg } from '@fmgc/guidance/lnav/legs/TF';
import { SegmentType } from '@fmgc/flightplanning/FlightPlanSegment';
import { WaypointConstraintType } from '@fmgc/flightplanning/FlightPlanManager';
import { CALeg } from '@fmgc/guidance/lnav/legs/CA';

export function procedureLegToLeg(prevLeg: ProcedureLeg, leg: ProcedureLeg, segmentType: SegmentType): Leg {
    switch (leg.type) {
    case LegType.AF:
        break;
    case LegType.CA:
        return new CALeg(leg.magneticCourse, leg.altitude1, segmentType, leg.turnDirection);
    case LegType.CD:
        break;
    case LegType.CF:
        break;
    case LegType.CI:
        break;
    case LegType.CR:
        break;
    case LegType.DF:
        break;
    case LegType.FA:
        break;
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
    case LegType.IF:
        break;
    case LegType.PI:
        break;
    case LegType.RF:
        break;
    case LegType.TF:
        return new TFLeg(leg, prevLeg.waypoint, leg.waypoint, WaypointConstraintType.CLB, segmentType);
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

    return undefined;
}

export function waypointToLeg(prevWaypoint: Waypoint, waypoint: Waypoint, constraintType: WaypointConstraintType, segmentType: SegmentType): TFLeg {
    return new TFLeg(undefined, prevWaypoint, waypoint, constraintType, segmentType);
}
