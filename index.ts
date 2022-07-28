import "dotenv/config";
import { TTweetv2TweetField, TTweetv2UserField, TwitterApi } from "twitter-api-v2";
import fs from "fs/promises";
import * as readline from "node:readline";
import express from "express";
import chalk from "chalk";
import ora from "ora";

interface Options {
	tweet_fields: TTweetv2TweetField[];
	user_fields: TTweetv2UserField[];
}

const app = express();
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const twitterClient = new TwitterApi({
	clientId: process.env.TWITTER_OAUTH2_CLIENT_ID || "",
	clientSecret: process.env.TWITTER_OAUTH2_CLIENT_SECRET || "",
});

const {
	url,
	codeVerifier,
	state: sessionState,
} = twitterClient.generateOAuth2AuthLink(process.env.CALLBACK_URL || "", {
	scope: ["users.read", "tweet.read"],
});

console.log(chalk.bold("Authorize by visiting this URL:\n"), chalk.underline(url));

app.listen(process.env.PORT);
app.get("/", async (req, res) => {
	const state = req.query.state?.toString();
	const code = req.query.code?.toString();

	if (state !== sessionState || !code) return res.status(400).send("State token didn't match");

	const { client } = await twitterClient.loginWithOAuth2({
		code,
		codeVerifier,
		redirectUri: process.env.CALLBACK_URL || "",
	});
	res.status(200).send("Successfully authenticated. Type username in the terminal.");

	const options: Options = {
		tweet_fields: [
			"attachments",
			"author_id",
			"context_annotations",
			"conversation_id",
			"created_at",
			"entities",
			"geo",
			"id",
			"in_reply_to_user_id",
			"lang",
			// "non_public_metrics",
			// "organic_metrics",
			"possibly_sensitive",
			// "promoted_metrics",
			"public_metrics",
			"referenced_tweets",
			"reply_settings",
			"source",
			"text",
			"withheld",
		],
		user_fields: [
			"created_at",
			"description",
			"entities",
			"id",
			"location",
			"name",
			"pinned_tweet_id",
			"profile_image_url",
			"protected",
			"public_metrics",
			"url",
			"username",
			"verified",
			"withheld",
		],
	};

	rl.question("Type twitter username: ", async (username) => {
		const spinner = ora(`Fetching user data of ${chalk.bold(`(@${username})`)}...`).start();
		
		try {
			const user = await client.v2.userByUsername(username, {
				expansions: ["pinned_tweet_id"],
				"tweet.fields": options.tweet_fields,
				"user.fields": options.user_fields,
			});
	
			if (!user.data) {
				throw `The user ${chalk.bold(`(@${username})`)} was not found.`
			}

			spinner.text = `Collecting ${chalk.bold(user.data.name + " (@" + user.data.username + ")")} tweets...`;

			const userTimeline = await client.v2.userTimeline(user.data.id, {
				expansions: [
					"attachments.media_keys",
					"attachments.poll_ids",
					"author_id",
					"entities.mentions.username",
					"geo.place_id",
					"in_reply_to_user_id",
					"referenced_tweets.id",
					"referenced_tweets.id.author_id",
				],
				max_results: 100,
				"media.fields": [
					"alt_text",
					"duration_ms",
					"height",
					"media_key",
					"non_public_metrics",
					"organic_metrics",
					"preview_image_url",
					"public_metrics",
					"type",
					"url",
					"width",
				],
				"place.fields": ["contained_within", "country", "country_code", "full_name", "geo", "id", "name", "place_type"],
				"poll.fields": ["duration_minutes", "end_datetime", "id", "options", "voting_status"],
				"tweet.fields": options.tweet_fields,
				"user.fields": options.user_fields,
			});

			const tweets = [];

			for await (const tweet of userTimeline) {
				tweets.push(tweet);
			}
			const fileName = 
				`${new Date().toLocaleDateString().replaceAll("/", "-")}_${new Date().toLocaleTimeString().replaceAll(":", "-")}_${user.data.username}.json`;

			const result = {
				user: user.data,
				tweets,
			};
			await fs.writeFile(`./tweets/${fileName}`, JSON.stringify(result, null, "\t"));

			spinner.succeed();
			console.log(`${chalk.greenBright(tweets.length)} tweet${tweets.length > 1 ? "s" : ""} saved to ${chalk.cyanBright(fileName)}.`);
			process.exit();
		} catch (error) {
			spinner.fail();
			console.log(`Collecting tweets of ${chalk.bold(`(@${username})`)} ${chalk.redBright.bold("failed")}:\n${chalk.redBright(error)}`);
			process.exit();
		}
	});
});
