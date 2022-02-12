import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import * as Defaults from './defaults';
import { SimVarProvider } from './simVars';

/**
 * Use the given React element to render the instrument using React.
 */
export const render = (Slot: React.ReactElement) => {
    Sentry.init({
        dsn: 'https://abd67c4440a644b3aaaf44838e565bea@o1135700.ingest.sentry.io/6185355',
        integrations: [new BrowserTracing()],

        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production
        tracesSampleRate: 1.0,
    });
    ReactDOM.render(<SimVarProvider>{Slot}</SimVarProvider>, Defaults.getRenderTarget());
};

/**
 * Computes time delta out of absolute env time and previous
 * time debounced on time shift.
 */
export const debouncedTimeDelta = (
    absTimeSeconds: number,
    prevTimeSeconds: number,
): number => {
    const diff = Math.max(absTimeSeconds - prevTimeSeconds, 0);
    // 60s detects forward time-shift
    return diff < 60 ? diff : 0;
};
