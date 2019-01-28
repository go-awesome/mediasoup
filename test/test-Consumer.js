const { toBeType } = require('jest-tobetype');
const mediasoup = require('../');
const { createWorker } = mediasoup;
const { UnsupportedError } = require('../lib/errors');

expect.extend({ toBeType });

let worker;
let router;
let transport1;
let transport2;
let audioProducer;
let videoProducer;
let audioConsumer;
let videoConsumer;

const mediaCodecs =
[
	{
		kind       : 'audio',
		name       : 'opus',
		mimeType   : 'audio/opus',
		clockRate  : 48000,
		channels   : 2,
		parameters :
		{
			useinbandfec : 0,
			foo          : 'bar'
		}
	},
	{
		kind      : 'video',
		name      : 'VP8',
		clockRate : 90000
	},
	{
		kind       : 'video',
		name       : 'H264',
		mimeType   : 'video/H264',
		clockRate  : 90000,
		parameters :
		{
			'level-asymmetry-allowed' : 1,
			'packetization-mode'      : 1,
			'profile-level-id'        : '4d0032',
			foo                       : 'bar'
		}
	}
];

const audioProducerParameters =
{
	kind          : 'audio',
	rtpParameters :
	{
		mid    : 'AUDIO',
		codecs :
		[
			{
				name        : 'OPUS',
				mimeType    : 'audio/opus',
				payloadType : 111,
				clockRate   : 48000,
				channels    : 2,
				parameters  :
				{
					useinbandfec : 1,
					foo          : 222.222,
					bar          : '333'
				}
			}
		],
		headerExtensions :
		[
			{
				uri : 'urn:ietf:params:rtp-hdrext:sdes:mid',
				id  : 10
			},
			{
				uri : 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
				id  : 12
			}
		],
		encodings : [ { ssrc: 11111111 } ],
		rtcp      :
		{
			cname : 'audio-1'
		}
	},
	appData : { foo: 1, bar: '2' }
};

const videoProducerParameters =
{
	kind          : 'video',
	rtpParameters :
	{
		mid    : 'VIDEO',
		codecs :
		[
			{
				name        : 'H264',
				mimeType    : 'video/h264',
				payloadType : 112,
				clockRate   : 90000,
				parameters  :
				{
					'packetization-mode' : 1,
					'profile-level-id'   : '4d0032'
				},
				rtcpFeedback :
				[
					{ type: 'nack' },
					{ type: 'nack', parameter: 'pli' },
					{ type: 'goog-remb' }
				]
			},
			{
				name        : 'rtx',
				mimeType    : 'video/rtx',
				payloadType : 113,
				clockRate   : 90000,
				parameters  : { apt: 112 }
			}
		],
		headerExtensions :
		[
			{
				uri : 'urn:ietf:params:rtp-hdrext:sdes:mid',
				id  : 10
			},
			{
				uri : 'urn:3gpp:video-orientation',
				id  : 13
			}
		],
		encodings :
		[
			{ ssrc: 22222222, rtx: { ssrc: 22222223 } },
			{ ssrc: 22222224, rtx: { ssrc: 22222225 } },
			{ ssrc: 22222226, rtx: { ssrc: 22222227 } },
			{ ssrc: 22222228, rtx: { ssrc: 22222229 } }
		],
		rtcp :
		{
			cname : 'video-1'
		}
	},
	appData : { foo: 1, bar: '2' }
};

const deviceCapabilities =
{
	codecs :
	[
		{
			name                 : 'opus',
			mimeType             : 'audio/opus',
			kind                 : 'audio',
			clockRate            : 48000,
			preferredPayloadType : 100,
			channels             : 2
		},
		{
			name                 : 'H264',
			mimeType             : 'video/H264',
			kind                 : 'video',
			clockRate            : 90000,
			preferredPayloadType : 101,
			rtcpFeedback         :
			[
				{ type: 'nack' },
				{ type: 'nack', parameter: 'pli' },
				{ type: 'ccm', parameter: 'fir' },
				{ type: 'goog-remb' }
			],
			parameters :
			{
				'level-asymmetry-allowed' : 1,
				'packetization-mode'      : 1,
				'profile-level-id'        : '42e01f'
			}
		},
		{
			name                 : 'rtx',
			mimeType             : 'video/rtx',
			kind                 : 'video',
			clockRate            : 90000,
			preferredPayloadType : 102,
			rtcpFeedback         : [],
			parameters           :
			{
				apt : 101
			}
		}
	],
	headerExtensions :
	[
		{
			kind             : 'audio',
			uri              : 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
			preferredId      : 1,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:ietf:params:rtp-hdrext:toffset',
			preferredId      : 2,
			preferredEncrypt : false
		},
		{
			kind             : 'audio',
			uri              : 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time', // eslint-disable-line max-len
			preferredId      : 3,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time', // eslint-disable-line max-len
			preferredId      : 3,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:3gpp:video-orientation',
			preferredId      : 4,
			preferredEncrypt : false
		},
		{
			kind             : 'audio',
			uri              : 'urn:ietf:params:rtp-hdrext:sdes:mid',
			preferredId      : 5,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:ietf:params:rtp-hdrext:sdes:mid',
			preferredId      : 5,
			preferredEncrypt : false
		},
		{
			kind             : 'video',
			uri              : 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id',
			preferredId      : 6,
			preferredEncrypt : false
		}
	],
	fecMechanisms : []
};

beforeAll(async () =>
{
	worker = await createWorker();
	router = await worker.createRouter({ mediaCodecs });
	transport1 = await router.createWebRtcTransport(
		{
			listenIps : [ '127.0.0.1' ]
		});
	transport2 = await router.createWebRtcTransport(
		{
			listenIps : [ '127.0.0.1' ]
		});
	audioProducer = await transport1.produce(audioProducerParameters);
	videoProducer = await transport1.produce(videoProducerParameters);
});

afterAll(() => worker.close());

test('transport.consume() succeeds', async () =>
{
	audioConsumer = await transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : deviceCapabilities,
			appData         : { baz: 'LOL' }
		});

	expect(audioConsumer.id).toBeType('string');
	expect(audioConsumer.producerId).toBe(audioProducer.id);
	expect(audioConsumer.closed).toBe(false);
	expect(audioConsumer.started).toBe(false);
	expect(audioConsumer.kind).toBe('audio');
	expect(audioConsumer.rtpParameters).toBeType('object');
	expect(audioConsumer.rtpParameters.mid).toBe(undefined);
	expect(audioConsumer.rtpParameters.codecs.length).toBe(1);
	expect(audioConsumer.rtpParameters.codecs[0]).toEqual(
		{
			name        : 'opus',
			mimeType    : 'audio/opus',
			clockRate   : 48000,
			payloadType : 100,
			channels    : 2,
			parameters  :
			{
				useinbandfec : 1,
				foo          : 222.222,
				bar          : '333'
			},
			rtcpFeedback : []
		});
	expect(audioConsumer.paused).toBe(false);
	expect(audioConsumer.producerPaused).toBe(false);
	expect(audioConsumer.preferredLayers).toBe(null);
	expect(audioConsumer.currentLayers).toBe(null);
	expect(audioConsumer.appData).toEqual({ baz: 'LOL' });

	expect(transport2.getConsumerById(audioConsumer.id)).toBe(audioConsumer);

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				id                       : router.id,
				mapProducerIdConsumerIds : { [audioProducer.id]: [ audioConsumer.id ] },
				mapConsumerIdProducerId  : { [audioConsumer.id]: audioProducer.id }
			});

	await expect(transport2.dump())
		.resolves
		.toMatchObject(
			{
				id          : transport2.id,
				producerIds : [],
				consumerIds : [ audioConsumer.id ]
			});

	videoConsumer = await transport2.consume(
		{
			producerId      : videoProducer.id,
			rtpCapabilities : deviceCapabilities,
			appData         : { baz: 'LOL' }
		});

	expect(videoConsumer.id).toBeType('string');
	expect(videoConsumer.producerId).toBe(videoProducer.id);
	expect(videoConsumer.closed).toBe(false);
	expect(videoConsumer.started).toBe(false);
	expect(videoConsumer.kind).toBe('video');
	expect(videoConsumer.rtpParameters).toBeType('object');
	expect(videoConsumer.rtpParameters.mid).toBe(undefined);
	expect(videoConsumer.rtpParameters.codecs.length).toBe(2);
	expect(videoConsumer.rtpParameters.codecs[0]).toEqual(
		{
			name        : 'H264',
			mimeType    : 'video/H264',
			clockRate   : 90000,
			payloadType : 103,
			parameters  :
			{
				'packetization-mode' : 1,
				'profile-level-id'   : '4d0032'
			},
			rtcpFeedback :
			[
				{ type: 'nack' },
				{ type: 'nack', parameter: 'pli' },
				{ type: 'ccm', parameter: 'fir' },
				{ type: 'goog-remb' }
			]
		});
	expect(videoConsumer.rtpParameters.codecs[1]).toEqual(
		{
			name         : 'rtx',
			mimeType     : 'video/rtx',
			clockRate    : 90000,
			payloadType  : 104,
			parameters   : { apt: 103 },
			rtcpFeedback : []
		});
	expect(videoConsumer.paused).toBe(false);
	expect(videoConsumer.producerPaused).toBe(false);
	expect(videoConsumer.preferredLayers).toBe(null);
	expect(videoConsumer.currentLayers).toBe(null);
	expect(videoConsumer.appData).toEqual({ baz: 'LOL' });

	expect(transport2.getConsumerById(videoConsumer.id)).toBe(videoConsumer);

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				id                       : router.id,
				mapProducerIdConsumerIds :
				{
					[audioProducer.id] : [ audioConsumer.id ],
					[videoProducer.id] : [ videoConsumer.id ]
				},
				mapConsumerIdProducerId :
				{
					[audioConsumer.id] : audioProducer.id,
					[videoConsumer.id] : videoProducer.id
				}
			});

	await expect(transport2.dump())
		.resolves
		.toMatchObject(
			{
				id          : transport2.id,
				producerIds : [],
				consumerIds : expect.arrayContaining([ audioConsumer.id, videoConsumer.id ])
			});
}, 2000);

test('transport.consume() with incompatible rtpCapabilities rejects with UnsupportedError', async () =>
{
	let invalidDeviceCapabilities;

	invalidDeviceCapabilities =
	{
		codecs :
		[
			{
				kind                 : 'audio',
				name                 : 'ISAC',
				mimeType             : 'audio/ISAC',
				clockRate            : 32000,
				preferredPayloadType : 100,
				channels             : 1
			}
		],
		headerExtensions : []
	};

	await expect(transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : invalidDeviceCapabilities
		}))
		.rejects
		.toThrow(UnsupportedError);

	invalidDeviceCapabilities =
	{
		codecs           : [],
		headerExtensions : []
	};

	await expect(transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : invalidDeviceCapabilities
		}))
		.rejects
		.toThrow(UnsupportedError);
}, 2000);

// test('consumer.dump() succeeds', async () =>
// {

// }, 2000);

test('consumer.getStats() succeeds', async () =>
{
	await expect(audioConsumer.getStats())
		.resolves
		.toEqual([]);

	await expect(videoConsumer.getStats())
		.resolves
		.toEqual([]);
}, 2000);

test('consumer.pause() and resume() succeed', async () =>
{
	await audioConsumer.pause();
	expect(audioConsumer.paused).toBe(true);

	// TODO
	// await expect(audioConsumer.dump())
	// 	.resolves
	// 	.toMatchObject({ paused: true });

	await audioConsumer.resume();
	expect(audioConsumer.paused).toBe(false);

	// TODO
	// await expect(audioConsumer.dump())
	// 	.resolves
	// 	.toMatchObject({ paused: false });
}, 2000);

test('Consumer emits "producerpause" and "producerresume"', async () =>
{
	await new Promise((resolve) =>
	{
		audioConsumer.on('producerpause', resolve);

		audioProducer.pause();
	});

	expect(audioConsumer.paused).toBe(false);
	expect(audioConsumer.producerPaused).toBe(true);

	await new Promise((resolve) =>
	{
		audioConsumer.on('producerresume', resolve);

		audioProducer.resume();
	});

	expect(audioConsumer.paused).toBe(false);
	expect(audioConsumer.producerPaused).toBe(false);
}, 2000);

test('consumer.close() succeeds', async () =>
{
	audioConsumer.close();
	expect(audioConsumer.closed).toBe(true);
	expect(transport2.getConsumerById(audioConsumer.id)).toBe(undefined);

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				id                       : router.id,
				mapProducerIdConsumerIds : { [audioProducer.id]: [] },
				mapConsumerIdProducerId  : {}
			});

	await expect(transport2.dump())
		.resolves
		.toMatchObject(
			{
				id          : transport2.id,
				producerIds : [],
				consumerIds : [ videoConsumer.id ]
			});
}, 2000);

test('Consumer methods reject if closed', async () =>
{
	await expect(audioConsumer.dump())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.getStats())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.pause())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.resume())
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.setPreferredLayers({}))
		.rejects
		.toThrow(Error);

	await expect(audioConsumer.requestKeyFrame())
		.rejects
		.toThrow(Error);
}, 2000);

test('Consumer emits "producerclose" if Producer is closed', async () =>
{
	audioConsumer = await transport2.consume(
		{
			producerId      : audioProducer.id,
			rtpCapabilities : deviceCapabilities
		});

	await new Promise((resolve) =>
	{
		audioConsumer.on('producerclose', resolve);

		audioProducer.close();
	});

	expect(audioConsumer.closed).toBe(true);
}, 2000);

test('Consumer emits "transportclose" if Transport is closed', async () =>
{
	videoConsumer = await transport2.consume(
		{
			producerId      : videoProducer.id,
			rtpCapabilities : deviceCapabilities
		});

	await new Promise((resolve) =>
	{
		videoConsumer.on('transportclose', resolve);

		transport2.close();
	});

	expect(videoConsumer.closed).toBe(true);

	await expect(router.dump())
		.resolves
		.toMatchObject(
			{
				id                       : router.id,
				mapProducerIdConsumerIds : {},
				mapConsumerIdProducerId  : {}
			});
}, 2000);