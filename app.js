const express = require("express")
const multer = require("multer")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")
const simpleGit = require("simple-git")

const { slugify } =
  require("transliteration")

const app = express()

app.use(cors())
app.use(express.json())

// public 폴더 제공
app.use(
  express.static("public")
)

// generated 폴더 제공
app.use(
  "/generated",
  express.static(
    path.join(
      __dirname,
      "generated"
    )
  )
)

// 업로드 임시 폴더
const upload = multer({
  dest: "uploads/"
})

// git 설정
const git = simpleGit()



// GitHub token
const token =
  process.env.GITHUB_TOKEN

// repo 주소
const repoUrl =
  `https://${token}@github.com/DEVFermium/GovGen.git`

// 사이트 ID 생성
function generateId(name) {

  const slug =
    slugify(name)
      .toLowerCase()

  const random =
    Math.random()
      .toString(36)
      .substring(2, 6)

  return `confirm-${slug}-${random}`
}

// generate API
app.post(
  "/generate",
  upload.single("photo"),
  async (req, res) => {

    try {

      const {
        name,
        birth,
        location,
        detailLocation,
        cityHall
      } = req.body

      // 고유 ID 생성
      const id =
        generateId(name)

      // 템플릿 경로
      const templateDir =
        path.join(
          __dirname,
          "templates",
          "default"
        )

      // 생성 경로
      const siteDir =
        path.join(
          __dirname,
          "generated",
          id
        )

      // 템플릿 전체 복사
      fs.cpSync(
        templateDir,
        siteDir,
        {
          recursive: true
        }
      )

      // HTML 수정
      const htmlPath =
        path.join(
          siteDir,
          "index.html"
        )

      let html =
        fs.readFileSync(
          htmlPath,
          "utf8"
        )

      html = html
        .replaceAll(
          "{{NAME}}",
          name || ""
        )
        .replaceAll(
          "{{BIRTH}}",
          birth || ""
        )
        .replaceAll(
          "{{LOCATION}}",
          location || ""
        )
        .replaceAll(
          "{{DETAIL_LOCATION}}",
          detailLocation || ""
        )
        .replaceAll(
          "{{CITY_HALL}}",
          cityHall || ""
        )

      fs.writeFileSync(
        htmlPath,
        html
      )

      // 이미지 저장
      if (req.file) {

        await sharp(req.file.path)
          .resize({
            width: 1200
          })
          .jpeg({
            quality: 90
          })
          .toFile(
            path.join(
              siteDir,
              "user-photo.jpg"
            )
          )

        // 임시파일 삭제
        fs.unlinkSync(
          req.file.path
        )
      }

      // Git remote 설정
      try {

        await git.removeRemote(
          "origin"
        )

      } catch {}

      await git.addRemote(
        "origin",
        repoUrl
      )

      // git add
      await git.add("./*")

      await git.raw([
        "config",
        "user.email",
        "bot@govgen.com"
        ])

        await git.raw([
        "config",
        "user.name",
        "GovGen Bot"
        ])

      // commit
      await git.commit(
        `create ${id}`
      )

      // push
      await git.push(
        "origin",
        "main"
      )

      // Netlify URL
      const siteUrl =
        `https://govgen24.netlify.app/${id}`

      // 응답
      res.json({
        success: true,
        id,
        url: siteUrl
      })

    } catch (err) {

      console.error(err)

      res.status(500).json({
        success: false,
        error: err.message
      })
    }
})

// 홈
app.get("/", (req, res) => {

  res.send(`
    <h1>
      GovGen API Server Running
    </h1>

    <a href="/test.html">
      test page
    </a>
  `)
})

// 서버 시작
app.listen(3000, () => {

  console.log(
    "server running on http://localhost:3000"
  )
})