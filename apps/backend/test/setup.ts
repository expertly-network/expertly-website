import 'reflect-metadata';
import { Logger } from '@nestjs/common';

// Keep spec output readable: services log through Nest's Logger. Specs that assert on log lines
// spy on Logger.prototype directly, which still sees every call.
Logger.overrideLogger(false);
