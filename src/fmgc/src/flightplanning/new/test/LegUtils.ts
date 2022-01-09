// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanElement, FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';

export function assertNotDiscontinuity(element: FlightPlanElement) {
    expect(element.isDiscontinuity).toBeFalsy();

    return element as FlightPlanLeg;
}
