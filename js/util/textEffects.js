/**
 * Creates a Phaser text object and precomputes wrapped line breaks,
 * returning the final text object with inserted `\n` where needed.
 *
 * @param {Phaser.Scene} scene - Scene used to create the text object.
 * @param {number} x - Text x position.
 * @param {number} y - Text y position.
 * @param {string} content - Raw text content to wrap.
 * @param {Object} [style={}] - Text style, including optional `wordWrap.width`.
 * @returns {Phaser.GameObjects.Text | null} The created wrapped text object, or null on invalid scene.
 */
function precomputeWrapText(scene, x, y, content, style = {}) {
    if (!Validation.isValidScene(scene)) {
        return null;
    }

    const safeContent = typeof content === 'string' ? content : String(content ?? '');
    const textObject = scene.add.text(x, y, '', style);
    const wrapWidth = style.wordWrap && typeof style.wordWrap.width === 'number' ? style.wordWrap.width : null;

    if (!wrapWidth) {
        textObject.setText(safeContent);
        return textObject;
    }

    const measureStyle = typeof textObject.style.toJSON === 'function' ? textObject.style.toJSON() : {};
    delete measureStyle.wordWrap;
    const measurer = scene.add.text(0, 0, '', measureStyle).setVisible(false);

    const measureWidth = (value) => {
        measurer.setText(value);
        return measurer.width;
    };

    const paragraphs = safeContent.split('\n');
    const wrappedLines = [];

    const CJK_TOKENIZER = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]|[^\s\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+|\s+/g;

    paragraphs.forEach((paragraph) => {
        if (paragraph === '') {
            wrappedLines.push('');
            return;
        }

        const tokens = paragraph.match(CJK_TOKENIZER) || [];
        let lineRaw = '';
        let lineMeasure = '';

        tokens.forEach((token) => {
            if (/^\s+$/.test(token)) {
                lineRaw += token;
                lineMeasure += token;
                return;
            }

            const measuredToken = token.replace(/%/g, '');
            const candidateRaw = lineRaw + token;
            const candidateMeasure = lineMeasure + measuredToken;

            if (lineMeasure.trim().length > 0 && measureWidth(candidateMeasure) > wrapWidth) {
                wrappedLines.push(lineRaw.trimEnd());
                lineRaw = token;
                lineMeasure = measuredToken;
                return;
            }

            lineRaw = candidateRaw;
            lineMeasure = candidateMeasure;
        });

        wrappedLines.push(lineRaw.trimEnd());
    });

    measurer.destroy();

    textObject.setText(wrappedLines.join('\n'));
    return textObject;
}