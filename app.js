const express = require("express")
const multer = require("multer")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")
const { Octokit } = require("@octokit/rest")
const { slugify } = require("transliteration")

const app = express()
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const GITHUB_OWNER = "DEVFermium"
const GITHUB_REPO = "GovGen"
const NETLIFY_BASE = "https://govgen24.netlify.app"

app.use(cors())
app.use(express.json())
app.use(express.static("public"))
app.use("/generated", express.static(path.join(__dirname, "generated")))

const upload = multer({ dest: "uploads/" })

// ✅ 사이트 ID 생성
function generateId(name) {
  const slug = slugify(name).toLowerCase()
  const random = Math.random().toString(36).substring(2, 6)
  return `confirm-${slug}-${random}`
}

// ✅ GitHub에 파일 1개 업로드 (생성 or 업데이트 자동 처리)
async function pushFileToGithub(filePath, contentBuffer) {
  let sha
  try {
    const existing = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
    })
    sha = existing.data.sha
  } catch {
    // 파일 없으면 sha 없이 새로 생성
  }

  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
    message: `create ${filePath}`,
    content: Buffer.from(contentBuffer).toString("base64"),
    sha,
  })
}

// ✅ 폴더 전체를 GitHub에 업로드
async function pushDirToGithub(localDir, githubBasePath) {
  const entries = fs.readdirSync(localDir, { withFileTypes: true })

  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name)
    const githubPath = `${githubBasePath}/${entry.name}`

    if (entry.isDirectory()) {
      await pushDirToGithub(localPath, githubPath)
    } else {
      const content = fs.readFileSync(localPath)
      await pushFileToGithub(githubPath, content)
    }
  }
}

// ✅ generate API
app.post("/generate", upload.single("photo"), async (req, res) => {
  try {
    const { name, birth, location, detailLocation, cityHall } = req.body

    if (!name) {
      return res.status(400).json({ success: false, error: "name is required" })
    }

    const id = generateId(name)
    const templateDir = path.join(__dirname, "templates", "default")
    const siteDir = path.join(__dirname, "generated", id)

    // 템플릿 복사
    fs.cpSync(templateDir, siteDir, { recursive: true })

    // HTML 수정
    const htmlPath = path.join(siteDir, "index.html")
    let html = fs.readFileSync(htmlPath, "utf8")

    html = html
      .replaceAll("{{NAME}}", name || "")
      .replaceAll("{{DATE}}", birth || "")
      .replaceAll("{{LOCATION}}", location || "")
      .replaceAll("{{LOCATIONDETAIL}}", detailLocation || "")
      .replaceAll("{{CITYHALL}}", cityHall || "")

    fs.writeFileSync(htmlPath, html)

    // 이미지 처리
    if (req.file) {
      await sharp(req.file.path)
        .resize({ width: 1200 })
        .jpeg({ quality: 90 })
        .toFile(path.join(siteDir, "user-photo.jpg"))

      fs.unlinkSync(req.file.path)
    }

    // ✅ GitHub에 전체 폴더 업로드 (git 없이 API로 직접)
    await pushDirToGithub(siteDir, `generated/${id}`)

    const siteUrl = `${NETLIFY_BASE}/${id}`

    res.json({ success: true, id, url: siteUrl })

  } catch (err) {
    console.error("❌ generate error:", err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// 홈
app.get("/", (req, res) => {
  res.send(`
    <h1>GovGen API Server Running</h1>
    <a href="/test.html">test page</a>
  `)
})

app.listen(3000, () => {
  console.log("server running on http://localhost:3000")
})