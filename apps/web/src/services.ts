import { createAuth } from "@pkmnteambuilder/auth";
import { createDb } from "@pkmnteambuilder/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
