const crypto = require('crypto');

/**
 * @param  {String} userPassword 
 * @param  {String} participantReference 
 * @param  {String} privateKey 
 */
module.exports = (userPassword, participantReference, privateKey) => {
    try {
        const rijndaelCipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(privateKey), Buffer.from(privateKey));
        rijndaelCipher.setAutoPadding(true);

        const plainText = `${userPassword}|${participantReference}`;
        let encryptedText = rijndaelCipher.update(plainText, 'utf-8', 'base64');
        encryptedText += rijndaelCipher.final('base64');

        return encryptedText;

    } catch (error) {
        console.error('Encryption failed:', error.message);
        throw error;
    }
}
