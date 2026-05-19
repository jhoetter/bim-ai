#!/usr/bin/env node
import { runTargetHouseCleanPassGateCli } from '../packages/cli/lib/target-house-clean-pass-gate.mjs';

process.exitCode = runTargetHouseCleanPassGateCli();
