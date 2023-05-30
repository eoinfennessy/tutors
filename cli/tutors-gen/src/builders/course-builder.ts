import {
  getArchive,
  getFilesWithType,
  getFileWithName,
  getGitLink,
  getId,
  getImage,
  getLabImage,
  getMarkdown,
  getPdf,
  getRoute,
  getVideo,
  getWebLink,
  readVideoIds,
} from "../utils/lr-utils";
import { AnswerOption, LabStep, LearningObject, LearningResource, preOrder, QuestionType } from "./lo-types";
import { readWholeFile, readYamlFile, writeFile } from "../utils/utils";
import fm from "front-matter";

export const courseBuilder = {
  lo: <LearningObject>{},

  buildCompositeLo(lo: LearningObject, lr: LearningResource, level: number): LearningObject {
    switch (lo.type) {
      case "unit":
        this.buildUnit(lo);
        break;
      case "side":
        this.buildSide(lo);
        break;
      default:
    }
    lr.lrs.forEach((lr) => {
      lo.los.push(this.buildLo(lr, level + 1));
      lo.los.sort((a: any, b: any) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return preOrder.get(a.type)! - preOrder.get(b.type)!;
      });
    });
    return lo;
  },

  buildSimpleLo(lo: LearningObject, lr: LearningResource): LearningObject {
    switch (lo.type) {
      case "lab":
        lo = this.buildLab(lo, lr);
        break;
      case "quiz":
        lo = this.buildQuiz(lo, lr);
        break;
      case "talk":
        this.buildTalk(lo);
        break;
      case "panelvideo":
        this.buildPanelvideo(lo);
        break;
      case "web":
        lo.route = getWebLink(lr);
        break;
      case "github":
        lo.route = getGitLink(lr);
        break;
      case "archive":
        lo.route = getArchive(lr);
        break;
      default:
    }
    return lo;
  },

  buildLo(lr: LearningResource, level: number): LearningObject {
    let lo = this.buildDefaultLo(lr);
    console.log(`${"-".repeat(level * 2)}: ${lo.id} : ${lo.title}`);
    if (lo.type === "unit" || lo.type == "side" || lo.type == "topic" || lo.type == "course") {
      lo = this.buildCompositeLo(lo, lr, level);
    } else {
      lo = this.buildSimpleLo(lo, lr);
    }
    return lo;
  },

  buildDefaultLo(lr: LearningResource): LearningObject {
    const [title, summary, contentMd, frontMatter] = getMarkdown(lr);
    const videoids = readVideoIds(lr);
    const lo: LearningObject = {
      route: getRoute(lr),
      type: lr.type,
      title: title,
      summary: summary,
      contentMd: contentMd,
      frontMatter: frontMatter,
      id: getId(lr),
      img: getImage(lr),
      pdf: getPdf(lr),
      video: getVideo(lr, videoids.videoid),
      videoids: videoids,
      los: [],
      hide: false,
    };
    return lo;
  },

  buildUnit(lo: LearningObject) {
    lo.route = lo.route.substring(0, lo.route.lastIndexOf("/")) + "/";
    lo.route = lo.route.replace("/unit", "/topic");
  },

  buildTalk(lo: LearningObject) {
    if (!lo.pdf) {
      lo.route = lo.video;
    }
  },

  buildSide(lo: LearningObject) {
    lo.route = lo.route.substring(0, lo.route.lastIndexOf("/")) + "/";
    lo.route = lo.route.replace("/side", "/topic");
  },

  buildPanelvideo(lo: LearningObject) {
    lo.route = lo.video;
  },

  buildLab(lo: LearningObject, lr: LearningResource): LearningObject {
    const mdFiles = getFilesWithType(lr, "md");
    lo.title = "";
    mdFiles.forEach((chapterName) => {
      const wholeFile = readWholeFile(chapterName);
      const contents = fm(wholeFile);
      let theTitle = contents.body.substring(0, contents.body.indexOf("\n"));
      theTitle = theTitle.replace("\r", "");
      const shortTitle = chapterName.substring(chapterName.indexOf(".") + 1, chapterName.lastIndexOf("."));
      if (lo.title == "") lo.title = shortTitle;
      const labStep: LabStep = {
        title: theTitle,
        shortTitle: shortTitle,
        contentMd: contents.body,
        route: `${getRoute(lr)}/${shortTitle}`,
        id: shortTitle,
      };
      lo.los.push(labStep);
    });
    lo.img = getLabImage(lr);
    // lr.lrs = [];
    return lo;
  },

  buildQuiz(lo: LearningObject, lr: LearningResource): LearningObject {
    const mdFiles = getFilesWithType(lr, "md").slice(1);
    mdFiles.forEach((filename) => {
      const title = filename.substring(filename.indexOf(".") + 1, filename.lastIndexOf("."));
      const wholeFile = readWholeFile(filename);
      const contents = fm(wholeFile);
      const fmAttributes = contents.attributes as Record<string, any>;

      let questionType: QuestionType;
      let questionMd: string;
      let answerOptions: AnswerOption[] = [];
      let textboxAnswers: string[] = [];
      const optionsStartIndex = contents.body.indexOf("\n- [x]");
      if (optionsStartIndex === -1) {
        questionType = "textbox";
        questionMd = contents.body;
        if (fmAttributes.textboxAnswers !== undefined) textboxAnswers = fmAttributes.textboxAnswers as string[];
      } else {
        const [question, ...opts] = contents.body.split("\n- [");
        questionMd = question;
        answerOptions = opts.map((opt) => ({ option: opt.slice(2).trim(), isAnswer: opt[0] === "x" }));
        const answerCount = answerOptions.reduce((a, opt) => {
          return opt.isAnswer ? a + 1 : a;
        }, 0);
        questionType = answerCount > 1 ? "checkbox" : "radio";
      }
      const labStep = {
        title,
        questionType,
        questionMd,
        ...(fmAttributes.explanation && { explanation: fmAttributes.explanation }),
        ...(fmAttributes.hint && { hint: fmAttributes.hint }),
        ...(answerOptions.length > 0 && { answerOptions }),
        ...(textboxAnswers.length > 0 && { textboxAnswers }),
        route: `${getRoute(lr)}/${title}`,
        id: title,
      };
      lo.los.push(labStep);
    });
    lo.img = getLabImage(lr);
    // lr.lrs = [];
    return lo;
  },

  buildCourse(lr: LearningResource) {
    this.lo = this.buildLo(lr, 0);
    this.lo.type = "course";
    this.lo.route = "/";
    const propertiesFile = getFileWithName(lr, "properties.yaml");
    if (propertiesFile) {
      this.lo.properties = readYamlFile(propertiesFile);
      const ignoreList = this.lo.properties?.ignore;
      if (ignoreList) {
        const los = this.lo.los.filter((lo) => ignoreList.indexOf(lo.id) >= 0);
        los.forEach((lo) => {
          if ("type" in lo) lo.hide = true;
        });
      }
    }
    const calendarFile = getFileWithName(lr, "calendar.yaml");
    if (calendarFile) {
      this.lo.calendar = readYamlFile(calendarFile);
    }
  },

  generateCourse(outputFolder: string) {
    writeFile(outputFolder, "tutors.json", JSON.stringify(this.lo));
  },
};
