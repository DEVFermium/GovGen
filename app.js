const express = require("express")
const multer = require("multer")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const { slugify } = require("transliteration")

const app = express()

app.use(cors())
app.use(express.json())

// 업로드 임시 폴더
const upload = multer({
  dest: "uploads/"
})

// 사이트 ID 생성
function generateId(name) {

  const slug =
    slugify(name)
      .toLowerCase()

  const random =
    Math.random()
      .toString(36)
      .substring(2, 6)

  return `confirm-${random}`
}

// 생성 API
app.post(
  "/generate",
  upload.single("photo"),
  async (req, res) => {

    try {

      // 입력값
      const {
        name,
        birth,
        location,
        detailLocation,
        cityHall
      } = req.body

      // 사이트 고유 ID
      const id =
        generateId(name)

      // 템플릿 경로
      const templateDir =
        path.join(
          __dirname,
          "templates",
          "default"
        )

      // 생성될 사이트 경로
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

      // index.html 경로
      const htmlPath =
        path.join(
          siteDir,
          "index.html"
        )

      // HTML 읽기
      let html =
        fs.readFileSync(
          htmlPath,
          "utf8"
        )

      // placeholder 치환
      html = html
        .replaceAll(
          "{{NAME}}",
          name || ""
        )
        .replaceAll(
          "{{DATE}}",
          birth || ""
        )
        .replaceAll(
          "{{LOCATION}}",
          location || ""
        )
        .replaceAll(
          "{{LOCATIONDETAIL}}",
          detailLocation || ""
        )
        .replaceAll(
          "{{CITYHALL}}",
          cityHall || ""
        )

      // 수정된 HTML 저장
      fs.writeFileSync(
        htmlPath,
        html
      )

      // 업로드 이미지 저장
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
        fs.unlinkSync(req.file.path)
      }

      // 성공 응답
      res.json({
        success: true,
        id,
        path: `/generated/${id}`
      })

    } catch (err) {

      console.error(err)

      res.status(500).json({
        success: false,
        error: err.message
      })
    }
})

// generated 폴더 정적 제공
app.use(
  "/generated",
  express.static(
    path.join(
      __dirname,
      "generated"
    )
  )
)

// 서버 실행
app.listen(3000, () => {

  console.log(
    "server running on http://localhost:3000"
  )
})