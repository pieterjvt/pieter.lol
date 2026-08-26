import { STATUS_CODES } from 'node:http';

const DESCRIPTIONS = new Map([
    [400, 'The server could not understand the request.'],
    [401, 'Authentication is required to access this page.'],
    [403, 'You do not have permission to access this page.'],
    [404, 'The requested page could not be found.'],
    [405, 'This request method is not allowed for this page.'],
    [406, 'The requested response format is not available.'],
    [408, 'The request took too long to complete.'],
    [409, 'The request conflicts with the current state of the resource.'],
    [410, 'The requested resource is no longer available.'],
    [413, 'The request is larger than the server allows.'],
    [414, 'The requested URL is longer than the server allows.'],
    [415, 'The request uses an unsupported media type.'],
    [422, 'The request was understood but could not be processed.'],
    [429, 'Too many requests were made in a short period of time.'],
    [431, 'The request headers are larger than the server allows.'],
    [451, 'The requested resource is unavailable for legal reasons.'],
    [500, 'An unexpected server error occurred.'],
    [501, 'The server does not support the requested functionality.'],
    [502, 'An upstream service returned an invalid response.'],
    [503, 'The service is temporarily unavailable.'],
    [504, 'An upstream service did not respond in time.'],
    [505, 'The requested HTTP version is not supported.'],
    [507, 'The server does not have enough storage to complete the request.'],
    [508, 'The server detected a loop while processing the request.'],
    [511, 'Network authentication is required to complete the request.']
]);

export function getHttpError(status) {
    const normalizedStatus = normalizeStatus(status);
    const standardName = STATUS_CODES[normalizedStatus];
    const name = standardName || defaultName(normalizedStatus);
    const description = DESCRIPTIONS.get(normalizedStatus) || defaultDescription(normalizedStatus);

    return {
        status: normalizedStatus,
        name: name.toLowerCase(),
        description
    };
}

function normalizeStatus(status) {
    const value = Number(status);

    if (Number.isInteger(value) && value >= 400 && value <= 599) {
        return value;
    }

    return 500;
}

function defaultName(status) {
    return status < 500 ? 'Client Error' : 'Server Error';
}

function defaultDescription(status) {
    return status < 500
        ? 'The request could not be completed.'
        : 'The server could not complete the request.';
}
