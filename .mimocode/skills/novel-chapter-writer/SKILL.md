---
name: novel-chapter-writer
description: "Write a novel chapter by reading story settings and the previous chapter, then generating new content that matches the established style, characters, and plot continuity."
---

# Novel Chapter Writer

Write one chapter of a novel by reading story context files and the previous chapter, then generating new prose that maintains continuity.

## Inputs

The user provides:
- **Project root** — the novel's working directory
- **Chapter number** — which chapter to write (1-indexed)
- **Chapter title** — the title for this chapter
- **Core event** — the key scene or plot beat for this chapter
- **Emotion axis** — the dominant emotional tone (e.g., "tension and restraint", "longing and denial")
- **Style notes** — any specific writing directives (e.g., "zero physical contact, rely on eye contact and breath")

## Procedure

1. **Read story context files** (adapt paths to the project structure):
   - Character cards (主角卡.md or equivalent)
   - Master settings / world bible (MASTER_SETTING.json or equivalent)
   - Idea bank (idea_bank.json or equivalent, if present)
   - Story system metadata (.story-system/ or .webnovel/ directories)

2. **Read the previous chapter** (if chapter number > 1):
   - Locate the most recent chapter file in the 正文/ (or chapters/) directory
   - Read the full text to understand where the story left off, the narrative voice, pacing, and unresolved tensions

3. **Generate the new chapter**:
   - Match the established narrative voice and tense
   - Maintain character consistency (speech patterns, physical descriptions, motivations)
   - Advance the plot according to the core event directive
   - Honor the emotion axis throughout
   - Follow any style notes strictly
   - Target the word count specified by the user (typically 3000-5000 characters)
   - End with a hook or suspense beat

4. **Save the chapter**:
   - Use the naming convention: `第{NNNN}章-{title}.md` (e.g., `第0003章-明暗.md`)
   - Save to the project's chapter directory (正文/ or chapters/)
   - Include a YAML frontmatter block with chapter number, title, and word count

5. **Report completion** with the saved file path and actual word count.

## Quality Checklist

- [ ] Characters behave consistently with their cards
- [ ] No plot contradictions with previous chapters
- [ ] Sensory details match the story's established perspective (e.g., painter's eye for visual arts stories)
- [ ] Dialogue feels natural for each character
- [ ] Chapter ending creates forward momentum
- [ ] No anachronisms or setting violations

## Notes

- This skill is designed for serialized fiction written chapter-by-chapter in separate sessions.
- Each session is typically one chapter — the skill bridges continuity by reading prior files.
- Works best when the user provides a clear "story bible" with character cards and setting documents.
