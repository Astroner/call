import { createHmac } from "crypto";

import { env } from "./env";

export const generateTurnCredentials = () => {
    const username = (Math.floor(Date.now() / 1000) + env.TURN_AUTH.TTL) + "";

    const password = createHmac("sha1", env.TURN_AUTH.SECRET)
        .update(username)
        .digest("base64");

    return { 
        username, 
        password,
        server: env.TURN_AUTH.TURN_SERVER
    }
}