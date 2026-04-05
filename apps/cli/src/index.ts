#!/usr/bin/env bun
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { saveCommand } from "./commands/save";
import { searchCommand } from "./commands/search";
import { contextCommand } from "./commands/context";
import { graphCommand } from "./commands/graph";
import { showCommand } from "./commands/show";
import { rmCommand } from "./commands/rm";
import { linksCommand } from "./commands/links";
import { editCommand } from "./commands/edit";
import { importCommand } from "./commands/import";
import { exportCommand } from "./commands/export";

const program = new Command();

program
  .name("mb")
  .version("0.1.0")
  .description("Mindbrain — persistent memory for AI coding agents");

program.addCommand(initCommand);
program.addCommand(saveCommand);
program.addCommand(searchCommand);
program.addCommand(contextCommand);
program.addCommand(graphCommand);
program.addCommand(showCommand);
program.addCommand(rmCommand);
program.addCommand(linksCommand);
program.addCommand(editCommand);
program.addCommand(importCommand);
program.addCommand(exportCommand);

program.parse();
