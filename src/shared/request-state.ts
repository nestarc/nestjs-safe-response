/**
 * Symbol constants for internal request state.
 *
 * These replace magic string properties (e.g., `__safeResponseWrapped`)
 * with Symbol.for() keys to prevent naming collisions and make the intent
 * explicit. Symbol.for() is used so that separate class instances
 * (interceptor + filter) can share the same Symbol via the global registry.
 */

/** Set by interceptor to prevent duplicate wrapping when the module is registered more than once. */
export const REQUEST_WRAPPED = Symbol.for('safeResponse.wrapped');

/** Set by interceptor to forward @ProblemType() metadata to the filter (filter cannot read handler metadata). */
export const REQUEST_PROBLEM_TYPE = Symbol.for('safeResponse.problemType');

/** Set by interceptor: high-resolution start time for response time calculation. */
export const REQUEST_START_TIME = Symbol.for('safeResponse.startTime');

/** Set by interceptor: resolved request ID, so the filter can reuse it instead of regenerating. */
export const REQUEST_ID = Symbol.for('safeResponse.requestId');

/** Set by filter to prevent duplicate error handling when the module is registered more than once. */
export const REQUEST_ERROR_HANDLED = Symbol.for('safeResponse.errorHandled');
