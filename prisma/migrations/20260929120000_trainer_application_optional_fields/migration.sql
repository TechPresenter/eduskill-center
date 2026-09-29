-- Short "Apply as a Teacher" form (/become-a-trainer/teach) feeds the SAME TrainerApplication
-- pipeline as the 8-step wizard, but deliberately asks only the fields needed for an initial
-- screening. These six columns are the ones it does not collect, so they become nullable rather
-- than being filled with invented values (a made-up date of birth, gender or address would be
-- worse than an honest NULL).
--
-- Nothing is dropped and no other table is touched: every existing row keeps its value, and the
-- 8-step wizard still sends all six.
ALTER TABLE "trainer_applications"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "dob" DROP NOT NULL,
  ALTER COLUMN "gender" DROP NOT NULL,
  ALTER COLUMN "address" DROP NOT NULL,
  ALTER COLUMN "pincode" DROP NOT NULL,
  ALTER COLUMN "motivation" DROP NOT NULL;
