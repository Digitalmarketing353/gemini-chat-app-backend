const { User, Conversation, Message } = require('../models');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({ 
        attributes: ['id', 'username', 'createdAt'],
        order: [['createdAt', 'DESC']] 
    });
    res.json(users);
  } catch (error) {
    console.error("Admin getUsers Error:", error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

exports.getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId, { attributes: ['id', 'username']});
    if (!user) return res.status(404).json({ message: 'User not found' });

    const conversations = await Conversation.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']],
      attributes: ['id', 'title', 'updatedAt', 'createdAt']
    });
    res.json({ user, conversations });
  } catch (error) {
    console.error("Admin getUserConversations Error:", error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findByPk(conversationId, { 
        include: [{ model: User, attributes: ['id', 'username']}] 
    });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const messages = await Message.findAll({
      where: { conversationId },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'role', 'content', 'createdAt']
    });
    res.json({ conversation, messages });
  } catch (error) {
    console.error("Admin getConversationMessages Error:", error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
};