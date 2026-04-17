/**
 * electron/mcp/tools/get-voice-model.cjs
 *
 * ramble.get_voice_model — retrieve the Notion voice model page.
 */

'use strict';

const { getVoiceModel } = require('../clients/notion-client.cjs');

module.exports = {
  name: 'ramble.get_voice_model',
  description:
    "Retrieve the user's voice model from the Notion KB. Used to calibrate translation output.",
  inputSchema: { type: 'object', properties: {} },
  handler: getVoiceModel,
};
