import dayjs from "dayjs";
import { KurssiParser } from "./parser";
import axios from "axios";
import "dotenv/config";
import { CronJob } from "cron";

const parser = new KurssiParser();

async function iterate() {
  const courses = await parser.getCourses(dayjs(), dayjs().add(1, "years"));

  for (const course of courses) {
    try {
      const { patientArea, patientAreaDescription } =
        await parser.parseCourseDetails(course.id);
      await axios.post(process.env.API_URL as string, {
        ...course,
        patientArea,
        patientAreaDescription,
      });
    } catch (error) {
      console.error(error);
    }
  }

  if (!process.env.CRON) {
    process.exit();
  }
}

if (process.env.PARSE_ON_BOOT === "true") {
  try {
    iterate();
  } catch (error) {
    console.error(error);
  }
}

if (process.env.CRON) {
  console.log(`cronjob scheduled for ${process.env.CRON}`);
  const job = CronJob.from({
    cronTime: process.env.CRON,
    onTick: function () {
      iterate();
    },
    start: true,
    timeZone: "Europe/Helsinki",
  });
}
