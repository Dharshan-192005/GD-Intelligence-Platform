const { PDFParse } = require('pdf-parse');
const geminiService = require('../services/geminiService');

const generateTopicsFromResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded.' });
    }

    let textContent = '';
    
    // Parse the file
    if (req.file.mimetype === 'application/pdf') {
      const parser = new PDFParse({ data: req.file.buffer });
      try {
        const data = await parser.getText();
        textContent = data.text;
      } finally {
        await parser.destroy?.();
      }
    } else {
      // Fallback for text files
      textContent = req.file.buffer.toString('utf8');
    }

    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from the file.' });
    }

    console.log('Generating custom topics from resume text...');
    
    // Use Gemini to generate 3 customized GD topics based on resume
    const topics = await geminiService.generateResumeTopics(textContent);
    
    return res.json({ topics });
  } catch (error) {
    console.error('Topic Generation Error:', error);
    return res.status(500).json({ error: 'Internal Server Error while parsing resume.' });
  }
};

module.exports = {
  generateTopicsFromResume
};
