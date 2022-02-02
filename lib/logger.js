'use babel';

import fs from 'fs';
import yaml from 'js-yaml';
import AWS from 'aws-sdk';
import { AWS_REGION, CLIENT_LOGS_GROUP_NAME, DIFF_SOURCE } from './constants';
import { readYML, isEmpty } from './utils/common';
import { generateSettings } from "./settings";

let cloudwatchlogs = {};
var pjson = require('../package.json');
VERSION = pjson.version;

export function putLogEvent(error, userEmail=null, additionalMsg="", retryCount=0) {
	let errorMsg = error;
	if (additionalMsg) {
		errorMsg = `${error}, ${additionalMsg}`;
	}
	console.log(errorMsg);

	const settings = generateSettings();
	if (!fs.existsSync(settings.USER_PATH)) { return; }
	const users = readYML(settings.USER_PATH);
	const sequenceTokenConfig = readYML(settings.SEQUENCE_TOKEN_PATH);
	let accessKey = '';
	let secretKey = '';
	let sequenceToken = '';
	let email = '';

	if (userEmail && userEmail in users) {
		const user = users[userEmail];
		email = userEmail;
		accessKey = user.access_key;
		secretKey = user.secret_key;
		sequenceToken = sequenceTokenConfig[userEmail];
	} else {
		Object.keys(users).forEach(function (_email, index) {
			if (index === 0) {
				email = _email;
				const user = users[email];
				accessKey = user.access_key;
				secretKey = user.secret_key;
				sequenceToken = sequenceTokenConfig[email];
			}
		});
	}

	if (!(accessKey && secretKey && email)) {
		return;
	}

	if (isEmpty(cloudwatchlogs)) {
		cloudwatchlogs = new AWS.CloudWatchLogs({
			accessKeyId: accessKey,
			secretAccessKey: secretKey,
			region: AWS_REGION
		});
	}

	const eventMsg = {
		msg: errorMsg,
		source: DIFF_SOURCE,
		version: VERSION
	};

	const logEvents = [ /* required */
		{
			message: JSON.stringify(eventMsg), /* required */
			timestamp: new Date().getTime() /* required */
		}
	];
	const logGroupName = CLIENT_LOGS_GROUP_NAME;
	const logStreamName = email;

	const params = {
		logEvents,
		logGroupName,
		logStreamName,
	};

	if (sequenceToken) {
		params.sequenceToken = sequenceToken;
	}

	cloudwatchlogs.putLogEvents(params, function(err, data) {

		if (!err) {
			// successful response
			updateSequenceToken(email, data.nextSequenceToken || "");
			return;
		}
		// an error occurred
		/*
		DataAlreadyAcceptedException: The given batch of log events has already been accepted.
		The next batch can be sent with sequenceToken: 49615429905286623782064446503967477603282951356289123634
		*/
		const errString = err.toString();
		if (errString.substr('DataAlreadyAcceptedException') || errString.substr('InvalidSequenceTokenException')) {
			const matches = errString.match(/(\d+)/);
			if (matches[0]) {
				sequenceTokenConfig[email] = matches[0];
				fs.writeFileSync(settings.SEQUENCE_TOKEN_PATH, yaml.safeDump(sequenceTokenConfig));
				if (retryCount) {
					if (retryCount <= 10) {
						retryCount += 1;
						putLogEvent(error, email, additionalMsg, retryCount);
					}
				} else {
					putLogEvent(error, email, additionalMsg, 1);
				}
			} else {
				console.log(err, err.stack);
			}
		} else {
			console.log(err, err.stack);
		}
	});
}

export const updateSequenceToken = (email, nextSequenceToken) => {
	const settings = generateSettings();
	const sequenceTokenConfig = readYML(settings.SEQUENCE_TOKEN_PATH);
	sequenceTokenConfig[email] = nextSequenceToken;
	fs.writeFileSync(settings.SEQUENCE_TOKEN_PATH, yaml.safeDump(sequenceTokenConfig));
};
