// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Airport, Database, Departure, ExternalBackend, Runway } from 'msfs-navdata';
import { DepartureSegment } from '@fmgc/flightplanning/new/segments/DepartureSegment';

/**
 * Loads an airport from the navigation database
 *
 * @param icao airport icao code
 *
 * @throws if the airport is not found
 */
export async function loadAirport(icao: string): Promise<Airport> {
    const db = new Database(new ExternalBackend('http://localhost:5000'));

    const airports = await db.getAirports([icao]);
    const matchingAirport = airports.find((a) => a.ident === icao);

    if (!matchingAirport) {
        throw new Error(`[FMS/FPM] Can't find airport with ICAO '${icao}'`);
    }

    return matchingAirport;
}

/**
 * Loads all runways for an airport
 *
 * @param airport Airport object
 */
export async function loadAllRunways(airport: Airport): Promise<Runway[]> {
    const db = new Database(new ExternalBackend('http://localhost:5000'));

    const runways = await db.getRunways(airport.ident);

    return runways;
}

/**
 * Loads a runway from the navigation database
 *
 * @param airport     Airport object
 * @param runwayIdent runway identifier
 *
 * @throws if the runway is not found
 */
export async function loadRunway(airport: Airport, runwayIdent: string): Promise<Runway> {
    const db = new Database(new ExternalBackend('http://localhost:5000'));

    const runways = await db.getRunways(airport.ident);
    const matchingRunway = runways.find((runway) => runway.ident === runwayIdent);

    if (!matchingRunway) {
        throw new Error(`[FMS/FPM] Can't find runway '${runwayIdent}' at ${airport.ident}`);
    }

    return matchingRunway;
}

/**
 * Loads all SIDs for an airport
 *
 * @param airport Airport object
 */
export async function loadAllDepartures(airport: Airport): Promise<Departure[]> {
    const db = new Database(new ExternalBackend('http://localhost:5000'));

    const proceduresAtAirport = await db.getDepartures(airport.ident);

    return proceduresAtAirport;
}
