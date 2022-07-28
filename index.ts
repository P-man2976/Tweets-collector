import "dotenv/config";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs/promises";
import * as readline from "node:readline";
import express from "express";
import chalk from "chalk";
import ora from "ora";

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

app.listen(8080);
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

	rl.question("Type twitter username: ", async (username) => {
		const user = await client.v2.userByUsername(username);

		if (!user.data) {
			console.log(`The user ${chalk.bold('(@' + username + ')')} was ${chalk.redBright("not found")}.`);
			process.exit();
		}
		const spinner = ora((`Collecting ${chalk.bold(user.data.name + " (@" + user.data.username + ")")} tweets...`)).start()

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
			"tweet.fields": [
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
				// 'non_public_metrics',
				// 'organic_metrics',
				"possibly_sensitive",
				//  'promoted_metrics',
				"public_metrics",
				"referenced_tweets",
				"reply_settings",
				"source",
				"text",
				"withheld",
			],
			"user.fields": [
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
		});

		const result = [];

		for await (const tweet of userTimeline) {
			result.push(tweet);
		}
		const fileName = 
			`${new Date().toLocaleDateString().replaceAll("/", "-")}-${new Date().toLocaleTimeString().replaceAll(":", "-")}_${user.data.username}.json`;

		await fs.writeFile(`./tweets/${fileName}`, JSON.stringify(result, null, "\t"));

		spinner.succeed();
		console.log(`${chalk.greenBright(result.length)} tweet${result.length > 1 ? 's' : ''} saved to ${chalk.blueBright(fileName)}.`);
		process.exit();
	});
});
