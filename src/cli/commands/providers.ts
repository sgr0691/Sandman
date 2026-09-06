import chalk from "chalk";
import { PROVIDER_CATALOG } from "../../providers/catalog.js";
import { emitOk } from "../output.js";

interface ProvidersOptions {
  json?: boolean;
}

export async function listProviders(
  options: ProvidersOptions = {},
): Promise<void> {
  emitOk(
    options.json,
    { providers: PROVIDER_CATALOG },
    () => {
      console.log(chalk.bold("\nProviders\n"));
      for (const provider of PROVIDER_CATALOG) {
        const badge =
          provider.maturity === "supported"
            ? chalk.green("supported")
            : chalk.yellow("experimental");
        console.log(`  ${chalk.bold(provider.id)}  ${badge}`);
        console.log(`    Services: ${provider.services.join(", ")}`);
        console.log(`    Auth: ${provider.auth}`);
        console.log(`    ${chalk.gray(provider.notes)}`);
        console.log();
      }
      console.log(
        chalk.cyan("→ Run \"sandman init <provider>\" to authenticate"),
      );
    },
  );
}
