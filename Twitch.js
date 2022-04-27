import axios from "axios";
import { Database } from "./Database.js";
import crypto from "crypto";
import qs from "qs";

export class Twitch {
  static instance = null;

  /**
   * Get the class instance
   * @returns {Twitch} instance
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new Twitch();
    }
    return this.instance;
  }

  /**
   * Retrieves the Twitch API access_token by cookie token
   * @param {String} token
   * @returns {Promise<String>} access_token
   */
  async getAccessTokenByToken(token) {
    let result = await (
      await Database.getInstance()
    ).get("SELECT access_token FROM token WHERE token=?;", token);
    if (!result) {
      return null;
    }
    return result.access_token;
  }

  /**
   * Get a poll by ID
   * @param {Number} broadcasterId User ID of the broadcaster
   * @param {String} pollId ID of the poll to get
   * @returns {Promise<Object>}
   */
  async getPoll(broadcasterId, pollId) {
    if (!broadcasterId || !pollId) {
      return null;
    }
    try {
      if (!this.checkAuthById(broadcasterId)) {
        return null;
      }
      let access_token = this.getAuthById(broadcasterId);
      let result = await axios.get(
        `https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}&id=${pollId}`,
        {
          headers: {
            Authorization: "OAuth " + access_token,
          },
        }
      );
      return result.data.data[0];
    } catch (e) {
      console.error(e.stack);
      return null;
    }
  }

  /**
   * Start a poll on the specified channel
   * @param {Number} userId User ID of the channel to start the poll on
   * @param {String} title Title of the poll
   * @param {String[]} outcomes Possible outcomes to vote on
   * @param {Number} time Duration of the poll in seconds
   * @return {Promise<Number>} Id of the poll, if successful
   */
  async startPoll(userId, title, outcomes, time) {
    if (!this.checkAuthById(userId)) {
      return null;
    }
    for (let i in outcomes) {
      outcomes[i] = { title: outcomes[i] };
    }
    let access_token = await this.getAuthById(userId);
    try {
      let result = await axios.post(
        "https://api.twitch.tv/helix/polls",
        {
          broadcaster_id: userId,
          title: title,
          choices: outcomes,
          duration: time,
        },
        {
          headers: {
            Authorization: "OAuth " + access_token,
          },
        }
      );
      return result.data.data[0].id;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  /**
   * Retrieves the Twitch API access_token by user id
   * @param {Number} userId
   * @returns {Promise<String>} access_token
   */
  async getAuthById(userId) {
    let result = await (
      await Database.getInstance()
    ).get("SELECT access_token FROM token WHERE user_id=?;", userId);
    if (!result) {
      return null;
    }
    return result.access_token;
  }

  /**
   * Returns the user id by access_token
   * @param {String} access_token
   * @returns {Promise<Number>} user id
   */
  async getIdByAuth(access_token) {
    try {
      let result = await axios.get("https://api.twitch.tv/helix/users", {
        headers: {
          Authorization: "Bearer " + access_token,
          "Client-Id": process.env.TWITCH_CLIENT_ID,
        },
      });
      if (result.data.data.length == 0) {
        return null;
      }
      return result.data.data[0].id;
    } catch (e) {
      return null;
    }
  }

  /**
   * Gets the user id by the cookie token supplied with requests
   * @param {String} cookieToken Parsed cookie token
   * @returns {Promise<String>}
   */
  async getIdByCookie(cookieToken) {
    try {
      let result = await (
        await Database.getInstance()
      ).get("SELECT user_id FROM token WHERE token=?;", cookieToken);
      if (!result) {
        return null;
      }
      return result.user_id;
    } catch (e) {
      return null;
    }
  }

  /**
   * Checks authorization against Twitch API by access_token
   * @param {Number} userId
   * @returns {Promise<Boolean>} DB contains valid access_token
   */
  async checkAuthById(userId) {
    if (!userId) {
      return false;
    }
    try {
      let result = await this.getAuthById(userId);
      if (!result) {
        return false;
      }
      return await this.checkAuth(result);
    } catch (e) {
      return false;
    }
  }

  /**
   * Checks authorization against Twitch API by access_token
   * @param {String} access_token
   * @returns {Promise<Boolean>} DB contains valid access_token
   */
  async checkAuth(access_token) {
    if (!access_token) {
      return false;
    }
    try {
      await axios.get("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: "OAuth " + access_token },
      });
      return true;
    } catch (e) {
      return await this.refreshAuth(access_token);
    }
  }

  /**
   * Refresh authorization by using refresh_token stored in DB
   * If refreshing is not successful, one should consider the app
   * to be not connected to the account.
   * @param {String} access_token
   * @returns {Promise<Boolean>} Wether refreshing was successful.
   */
  async refreshAuth(access_token) {
    try {
      let refresh_token = await (
        await Database.getInstance()
      ).get(
        "SELECT refresh_token FROM token WHERE access_token=?;",
        access_token
      );
      if (!refresh_token) {
        return false;
      }
      let result = await axios.post(
        "https://id.twitch.tv/oauth2/token",
        qs.stringify({
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: refresh_token.refresh_token,
        })
      );
      let id = await this.getIdByAuth(result.data.access_token);
      await (
        await Database.getInstance()
      ).run(
        "UPDATE token SET access_token=? WHERE user_id=?",
        result.data.access_token,
        id
      );
      if (result.data.refresh_token != "") {
        await (
          await Database.getInstance()
        ).run(
          "UPDATE token SET refresh_token=? WHERE user_id=?",
          result.data.refresh_token,
          id
        );
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Authorizes a user to use the applciation aftrgranting access
   * on Twitch.
   * @param {String} code Code retrieved by the first step of auth
   * @returns {(String|null)} The cookie token stored in DB or null if not successful
   */
  async authorize(code) {
    try {
      let result = await axios.post(
        "https://id.twitch.tv/oauth2/token",
        qs.stringify({
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: code,
          redirect_uri: encodeURI(process.env.HOST + "/auth"),
          grant_type: "authorization_code",
        })
      );
      let id = await this.getIdByAuth(result.data.access_token);
      if (id == null) {
        console.error("Authorization w/o user. This should never occur.");
        return null;
      }
      if (!process.env.ALLOWED_USERS.split(",").includes(id)) {
        return null;
      }
      let token = crypto.randomBytes(32).toString("base64");
      await (
        await Database.getInstance()
      ).run(
        "REPLACE INTO token VALUES (?,?,?,?);",
        id,
        result.data.access_token,
        result.data.refresh_token,
        token
      );
      return token;
    } catch (e) {
      console.log(e);
      return null;
    }
  }
}
