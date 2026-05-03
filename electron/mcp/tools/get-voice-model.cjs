/**
 * electron/mcp/tools/get-voice-model.cjs
 *
 * ramble.get_voice_model — retrieve the Notion voice model page.
 */

'use strict';

const { getVoiceModel } = require('../clients/notion-client.cjs');

module.exports = {
  name: 'ramble.get_voice_model',
  title: 'Retrieve voice model',
  description:
    "Retrieve the user's voice model from the Notion KB. Used to calibrate translation output.",
  inputSchemaZod: {},
  annotations: {
    title: 'Retrieve voice model',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: getVoiceModel,
};
