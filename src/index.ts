import dayjs from "dayjs";
import { KurssiParser } from "./parser";
import { writeFile } from "fs/promises";

const parser = new KurssiParser();

parser.getCourses(dayjs(), dayjs().add(1, "years")).then((courses) => {
  for (const course of courses) {
    writeFile(
      `./json/${course.name}-${course.id}.json`,
      JSON.stringify(course, null, 2)
    );
  }
});
