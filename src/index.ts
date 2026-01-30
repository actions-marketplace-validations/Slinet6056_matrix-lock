import * as core from "@actions/core"
import artifact from "@actions/artifact"
import * as fs from "fs"
import * as path from "path"

const FILE_NAME = "matrix-lock-17c3b450-53fd-4b8d-8df8-6b5af88022dc.lock"
const ARTIFACT_NAME = "matrix-lock"

async function run(): Promise<void> {
    try {
        const workspace = process.env.GITHUB_WORKSPACE

        if (!workspace) {
            throw new Error("GITHUB_WORKSPACE environment variable is not set")
        }

        const fullPath = path.join(workspace, FILE_NAME)
        const step = core.getInput("step", { required: true })

        switch (step) {
            case "init":
                await handleInit(fullPath, workspace)
                break

            case "wait":
                await handleWait(fullPath, workspace)
                break

            case "continue":
                await handleContinue(fullPath, workspace)
                break

            default:
                throw new Error(`Unknown step: ${step}`)
        }
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message)
        } else {
            core.setFailed("An unknown error occurred")
        }
    }
}

async function handleInit(fullPath: string, workspace: string): Promise<void> {
    const order = core.getInput("order", { required: true })
    core.info(`Initializing matrix lock with order: ${order}`)

    fs.writeFileSync(fullPath, order)

    const response = await artifact.uploadArtifact(
        ARTIFACT_NAME,
        [fullPath],
        workspace
    )

    core.info(`✓ Matrix lock initialized successfully (ID: ${response.id})`)
}

async function handleWait(fullPath: string, workspace: string): Promise<void> {
    core.info("Waiting for lock...")

    const id = core.getInput("id", { required: true })
    const retryCount = parseInt(core.getInput("retry-count") || "6", 10)
    const retryDelay = parseInt(core.getInput("retry-delay") || "10", 10)

    let shouldContinue = false

    for (let attempt = 0; attempt < retryCount; attempt++) {
        core.info(`Attempt ${attempt + 1}/${retryCount}`)

        try {
            const artifactInfo = await artifact.getArtifact(ARTIFACT_NAME)
            await artifact.downloadArtifact(artifactInfo.artifact.id, {
                path: workspace,
            })

            const lockContent = fs.readFileSync(fullPath, { encoding: "utf8" })
            const currentId = lockContent.split(",")[0]

            core.info(`Current lock holder: ${currentId}`)
            core.info(`Waiting for: ${id}`)

            if (id === currentId) {
                shouldContinue = true
                core.info(`✓ Lock acquired for: ${id}`)
                break
            }

            if (attempt < retryCount - 1) {
                core.info(
                    `Waiting ${retryDelay} seconds before next attempt...`
                )
                await sleep(1000 * retryDelay)
            }
        } catch (error) {
            core.warning(
                `Failed to download artifact on attempt ${attempt + 1}: ${error}`
            )
            if (attempt < retryCount - 1) {
                await sleep(1000 * retryDelay)
            }
        }
    }

    if (!shouldContinue) {
        throw new Error(
            `Max retries (${retryCount}) reached. Failed to acquire lock for: ${id}`
        )
    }

    core.info("Lock is ready")
}

async function handleContinue(
    fullPath: string,
    workspace: string
): Promise<void> {
    core.info("Releasing lock...")

    const artifactInfo = await artifact.getArtifact(ARTIFACT_NAME)
    await artifact.downloadArtifact(artifactInfo.artifact.id, {
        path: workspace,
    })

    const lockContent = fs.readFileSync(fullPath, { encoding: "utf8" })
    const orderArray = lockContent.split(",")
    const releasedId = orderArray[0]
    const newOrder = orderArray.slice(1).join(",")

    core.info(`Released lock for: ${releasedId}`)

    if (newOrder) {
        fs.writeFileSync(fullPath, newOrder)
        await artifact.uploadArtifact(ARTIFACT_NAME, [fullPath], workspace)
        core.info(`Next in queue: ${newOrder.split(",")[0]}`)
    } else {
        core.info("✓ All jobs completed, lock released")
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

run()
