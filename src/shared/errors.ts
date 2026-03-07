import type { ErrorClass } from './types.js';

export class WebsourceError extends Error {
  constructor(
    message: string,
    public readonly errorClass: ErrorClass,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'WebsourceError';
  }
}

export class NetworkError extends WebsourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'network', cause);
    this.name = 'NetworkError';
  }
}

export class ParseError extends WebsourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'parse', cause);
    this.name = 'ParseError';
  }
}

export class SelectorError extends WebsourceError {
  constructor(message: string, public readonly selector: string, cause?: Error) {
    super(message, 'selector', cause);
    this.name = 'SelectorError';
  }
}

export class ValidationError extends WebsourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'validation', cause);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends WebsourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'timeout', cause);
    this.name = 'TimeoutError';
  }
}

export class RobotsBlockedError extends WebsourceError {
  constructor(url: string) {
    super(`Blocked by robots.txt: ${url}`, 'robots');
    this.name = 'RobotsBlockedError';
  }
}
