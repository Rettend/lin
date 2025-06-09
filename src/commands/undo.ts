import fs from 'node:fs'
import path from 'node:path'
import { defineCommand } from 'citty'
import { commonArgs, resolveConfig } from '@/config'
import { console, ICONS } from '@/utils'
import { UNDO_DIR, UNDO_FILE, UNDO_FILE_NON_EXISTENT } from '@/utils/undo'

export default defineCommand({
  meta: {
    name: 'undo',
    description: 'revert the last modification to locale files',
  },
  args: {
    ...commonArgs,
  },
  async run({ args }) {
    const { config } = await resolveConfig(args)
    const undoFilepath = path.join(config.cwd, UNDO_DIR, UNDO_FILE)

    if (!fs.existsSync(undoFilepath)) {
      console.log(ICONS.info, 'Nothing to undo.')
      return
    }

    const undoData: Record<string, string> = JSON.parse(fs.readFileSync(undoFilepath, 'utf-8'))

    await console.loading('Reverting changes...', async () => {
      for (const [filePath, content] of Object.entries(undoData)) {
        try {
          if (content === UNDO_FILE_NON_EXISTENT) {
            if (fs.existsSync(filePath))
              fs.unlinkSync(filePath)
          }
          else {
            fs.writeFileSync(filePath, content, 'utf-8')
          }
        }
        catch (error) {
          console.log(ICONS.error, `Failed to restore file ${filePath}: ${error}`)
        }
      }

      fs.unlinkSync(undoFilepath)
    })

    console.log(ICONS.success, 'Successfully reverted changes.')
  },
})
