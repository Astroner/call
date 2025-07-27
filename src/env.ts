import { config } from "dotenv";

config();
export const env = {
    PORT: process.env.PORT ? +process.env.PORT : 8080,
    HOST: process.env.HOST ?? "localhost",
    MAX_ROOMS: process.env.MAX_ROOMS ? +process.env.MAX_ROOMS : 20,
    TURN_AUTH: {
        SECRET: process.env.SECRET ?? "Error",
        TTL: (process.env.TTL ? +process.env.TTL : 1) * 3600,
        TURN_SERVER: process.env.TURN_SERVER ?? "ERROR",
    }
}