// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Location, Waypoint, WaypointArea } from 'msfs-navdata';
import { placeBearingDistance } from 'msfs-geo';
import { fixCoordinates } from '@fmgc/flightplanning/new/utils';

export namespace WaypointFactory {

    export function fromWaypointAndDistanceBearing(
        ident: string,
        waypoint: Waypoint,
        distance: NauticalMiles,
        bearing: DegreesTrue,
    ): Waypoint {
        const location = placeBearingDistance(fixCoordinates(waypoint.location), bearing, distance);

        const point: Location = { lat: location.lat, lon: location.long };

        return {
            databaseId: 'W      CF   ',
            icaoCode: '  ',
            area: WaypointArea.Enroute,
            ident,
            location: point,
        };
    }

}
