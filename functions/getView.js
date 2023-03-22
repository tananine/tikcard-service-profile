const { throwError } = require('../functions/throwError');
const {
  getArrayContactIncludeContactItem,
} = require('../functions/getArrayContact');
const db = require('../models/index');

exports.getView = async (profileId) => {
  let info = null;
  let contacts = [];

  await db.Info.findOne({
    where: { profileId: profileId },
  })
    .then((infoData) => {
      if (!infoData) {
        throwError(404, 'ไม่พบ Info', {
          profileId: profileId,
        });
      }
      info = infoData;
    })
    .catch((error) => {
      throw error;
    });

  contacts = await getArrayContactIncludeContactItem(profileId);
  return { info: info, contacts: contacts };
};