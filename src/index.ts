import dayjs from "dayjs";
import { KurssiParser } from "./parser";
import { writeFile } from "fs/promises";
import axios from "axios";
import "dotenv/config";

const parser = new KurssiParser();

parser.getCourses(dayjs(), dayjs().add(1, "years")).then(async (courses) => {
  for (const course of courses) {
    // writeFile(
    //   `./json/${course.name}-${course.id}.json`,
    //   JSON.stringify(course, null, 2)
    // );
    const { patientArea, patientAreaDescription } =
      await parser.parseCourseDetails(course.id);
    await axios.post(
      `http://localhost:3000/api/course?postSecret=${process.env.POST_SECRET}`,
      { ...course, patientArea, patientAreaDescription }
    );
  }
});
