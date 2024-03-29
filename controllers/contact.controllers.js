const { validationResult } = require('express-validator');
const { throwError } = require('../functions/throwError');
const {
  getArrayContact,
  getArrayContactIncludeContactItem,
} = require('../functions/getArrayContact');
const db = require('../models/index');

const getAllContactAppList = (req, res, next) => {
  db.ContactItem.findAll({
    order: [['id', 'ASC']],
  })
    .then((items) => {
      return res.status(200).json(items);
    })
    .catch((error) => {
      next(error);
    });
};

const getMyContact = async (req, res, next) => {
  const profileId = req.headers.profile;

  try {
    const contacts = await getArrayContactIncludeContactItem(profileId);
    return res.status(200).json(contacts);
  } catch (error) {
    next(error);
  }
};

const addContact = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throwError(400, errors.array()[0].msg, errors.array(), true);
    }

    const profileId = req.headers.profile;
    const contactItemId = req.body.contactItemId;
    const name = req.body.name;
    const data = req.body.data;
    const note = req.body.note;

    const latitude = req.body.latitude;
    const longitude = req.body.longitude;

    const contacts = await getArrayContact(profileId);
    const lastIndexContacts = contacts[contacts.length - 1]?.id || null;
    const createContact = await db.Contact.create({
      contactItemId: contactItemId,
      profileId: profileId,
      name: name,
      data: data,
      show: 'enable',
      afterContactId: lastIndexContacts,
      note: note,
      latitude: latitude,
      longitude: longitude,
    });
    await createContact.save();
    return res.status(200).json('เพิ่มสำเร็จ');
  } catch (error) {
    next(error);
  }
};

const updateContact = (req, res, next) => {
  const profileId = req.headers.profile;
  const contactId = req.body.contactId;
  const name = req.body.name;
  const data = req.body.data;
  const note = req.body.note;

  const latitude = req.body.latitude;
  const longitude = req.body.longitude;

  db.Contact.update(
    {
      name: name,
      data: data,
      note: note,
      latitude: latitude,
      longitude: longitude,
    },
    {
      where: {
        id: contactId,
        profileId: profileId,
      },
    }
  )
    .then((isUpdate) => {
      if (!isUpdate[0]) {
        throwError(
          400,
          'อัพเดทไม่สำเร็จ',
          {
            contactId: contactId,
          },
          false
        );
      }
      return res.status(200).json('อัพเดท Contact สำเร็จ');
    })
    .catch((error) => {
      next(error);
    });
};

const deleteContact = async (req, res, next) => {
  const profileId = req.headers.profile;
  const contactId = req.params.contactId;

  const transaction = await db.sequelize.transaction();
  transaction.afterCommit(() => {
    return res.status(200).json({ message: 'ลบสำเร็จ' });
  });

  try {
    const contacts = await getArrayContact(profileId);
    const targetIndex = contacts.findIndex(
      (contact) => contact.id === parseInt(contactId)
    );
    if (contacts[targetIndex + 1]) {
      await db.Contact.update(
        {
          afterContactId: contacts[targetIndex].afterContactId,
        },
        {
          where: {
            id: contacts[targetIndex + 1].id,
            profileId: profileId,
          },
          transaction: transaction,
        }
      );
    }
    await db.Contact.destroy({
      where: { id: contactId, profileId: profileId },
      transaction: transaction,
    }).then((isDestroy) => {
      if (!isDestroy) {
        throwError(
          404,
          'ไม่พบข้อมูล',
          {
            contactId: contactId,
            profileId: profileId,
          },
          false
        );
      }
    });
    transaction.commit();
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const toggleEnable = (req, res, next) => {
  const profileId = req.headers.profile;
  const contactId = req.body.contactId;

  db.Contact.findOne({ where: { id: contactId, profileId: profileId } })
    .then((contact) => {
      if (!contact) {
        throwError(
          404,
          'ไม่พบข้อมูล',
          {
            contactId: contactId,
            profileId: profileId,
          },
          false
        );
      }
      const show = contact.show === 'enable' ? 'disable' : 'enable';
      return db.Contact.update(
        { show: show },
        {
          where: { id: contactId, profileId: profileId },
          returning: true,
        }
      );
    })
    .then((dataUpdate) => {
      return res.status(200).json(dataUpdate[1][0]);
    })
    .catch((error) => {
      next(error);
    });
};

const updateSort = async (req, res, next) => {
  const profileId = req.headers.profile;
  const contactId = parseInt(req.body.contactId);
  const afterContactId = parseInt(req.body.afterContactId) || null;

  const transaction = await db.sequelize.transaction();
  transaction.afterCommit(() => {
    return res.status(200).json({ message: 'เรียงลำดับสำเร็จ' });
  });

  try {
    const contacts = await getArrayContact(profileId);

    const presentIndex = contacts.findIndex(
      (contact) => contact.id === parseInt(contactId)
    );

    const targetIndex = contacts.findIndex((contact) => {
      return contact.afterContactId === afterContactId;
    });

    if (presentIndex === targetIndex) {
      throwError(
        400,
        'present เท่ากับ target',
        {
          profileId: profileId,
          contactId: contactId,
          afterContactId: afterContactId,
        },
        false
      );
    }

    const updateAfterContactAtPresentIndex = async () => {
      await db.Contact.update(
        {
          afterContactId: afterContactId,
        },
        {
          where: {
            id: contactId,
            profileId: profileId,
          },
          transaction: transaction,
        }
      );
    };

    const updateAfterContactAtTargetIndex = async () => {
      await db.Contact.update(
        {
          afterContactId: contactId,
        },
        {
          where: {
            id: contacts[targetIndex].id,
            profileId: profileId,
          },
          transaction: transaction,
        }
      );
    };

    const updateAfterContactAtAfterPresentIndex = async () => {
      await db.Contact.update(
        {
          afterContactId: contacts[presentIndex].afterContactId,
        },
        {
          where: {
            id: contacts[presentIndex + 1].id,
            profileId: profileId,
          },
          transaction: transaction,
        }
      );
    };

    if (contactId === afterContactId) {
      throwError(
        400,
        'ไม่สามารถ Sort ได้',
        {
          contactId: contactId,
          afterContactId: afterContactId,
        },
        false
      );
    }
    await updateAfterContactAtPresentIndex();
    if (targetIndex > -1) {
      await updateAfterContactAtTargetIndex();
    }
    if (contacts[presentIndex + 1]) {
      await updateAfterContactAtAfterPresentIndex();
    }
    transaction.commit();
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getAllContactAppList,
  getMyContact,
  addContact,
  updateContact,
  deleteContact,
  toggleEnable,
  updateSort,
};
