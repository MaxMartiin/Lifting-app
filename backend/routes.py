from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal, Exercise, Set, Session as WorkoutSession, Template, TemplateExercise
from pydantic import BaseModel

router = APIRouter()
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LogSetRequest(BaseModel):
    session_id: int
    exercise_id: int
    weight: float
    reps: int

class CreateExcersizeRequest(BaseModel):
    name: str
    category: str
    increment: float = 5

class CreateTemplateRequest(BaseModel):
    name: str
    exercise_ids: list[int]

class CreateSessionRequest(BaseModel):
    template_id: int

@router.post("/sessions")
def create_session(req: CreateSessionRequest):
    db = SessionLocal()
    try:
        # TODO: verify the template actually exists (look up by id)
        template = db.query(Template).filter(Template.id == req.template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # TODO: create a new WorkoutSession with template_id set
        workout_session = WorkoutSession(template_id=req.template_id)
        # TODO: add, commit, refresh
        db.add(workout_session)
        db.commit()
        db.refresh(workout_session)

        # TODO: return the new session's id
        return {"session_id": workout_session.id}
    finally:
        db.close()


@router.post("/templates")
def create_template(req: CreateTemplateRequest):
    db = SessionLocal()
    try:
        template = Template(name=req.name)
        db.add(template)
        db.flush() # writes to DB and assigns the ID, but doesn't make it PERMANENT yet

        for exercise_id in req.exercise_ids:
            template_exercise = TemplateExercise(template_id=template.id, exercise_id=exercise_id)
            db.add(template_exercise)

        db.commit()
        db.refresh(template)
        return {"template_ID": template.id, "name": template.name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()


@router.post("/exercises")
def create_exercise(req: CreateExcersizeRequest):
    db = SessionLocal()
    try:
        exercise = Exercise(name=req.name, category=req.category, increment=req.increment)
        db.add(exercise)
        db.commit()
        db.refresh(exercise)
        return {"exercise_ID": exercise.id, "name": exercise.name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()

@router.post("/sets")
def log_set(req: LogSetRequest):
    db = SessionLocal()
    try:
        # Check if this weight is a PR for this exercise
        best = db.query(Set)\
            .filter(Set.exercise_id == req.exercise_id)\
            .order_by(Set.weight.desc())\
            .first()
        is_pr = best is None or req.weight > best.weight

        #check how many sets have been logged for this exercise in this session
        set_count = db.query(Set).filter(Set.session_id == req.session_id, Set.exercise_id == req.exercise_id).count()

        # Log the set
        new_set = Set(
            session_id=req.session_id,
            exercise_id=req.exercise_id,
            weight=req.weight,
            reps=req.reps,
            is_pr=is_pr,
            set_number=set_count + 1
        )
        db.add(new_set)
        db.commit()
        db.refresh(new_set)
        return {
            "id": new_set.id,
            "weight": new_set.weight,
            "reps": new_set.reps,
            "is_pr": new_set.is_pr,
            "set_number": new_set.set_number
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()

@router.get("/templates/{template_id}/workout")
def get_template_workout(template_id: int, session_id: int):
    db = SessionLocal()
    try:
        template = db.query(Template).filter(Template.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        template_exercises = db.query(TemplateExercise).filter(
            TemplateExercise.template_id == template_id
        ).all()

        exercise_results = []
        for te in template_exercises:
            exercise = db.query(Exercise).filter(Exercise.id == te.exercise_id).first()
            recommendation = get_recommendation(te.exercise_id, session_id)
            exercise_results.append({
                "exercise_id": te.exercise_id,
                "name": exercise.name if exercise else "Unknown",
                "recommendation": recommendation
            })

        return {
            "template_id": template.id,
            "template_name": template.name,
            "exercises": exercise_results
        }
    finally:
        db.close()

@router.get("/recommend/{exercise_id}")
def get_recommendation(exercise_id: int, session_id: int):
    db = SessionLocal()
    try:
        # TODO 1: check if any sets exist for this exercise in THIS session already
        # (mid-session case)
        sets_today = db.query(Set).filter(Set.session_id == session_id, Set.exercise_id == exercise_id).all()

        if sets_today:
            basis_set = max(sets_today, key=lambda s: s.set_number)  # use the set with the highest set_number
        else:
            # TODO 2: new session case — find the most recent OTHER session
            # that has a set_number == 1 for this exercise, and use that set
            basis_sets = db.query(Set).filter(Set.exercise_id == exercise_id, Set.set_number == 1).all()
            if not basis_sets:
                return {"weight": None, "note": "No history yet — start light!"}
            basis_set = max(basis_sets, key= lambda s: s.id)

        # TODO 3: apply the reps rule to basis_set.weight and basis_set.reps
        exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()

        if basis_set.reps >= 8:
            next_weight = basis_set.weight + exercise.increment
        elif basis_set.reps >= 5:
            next_weight = basis_set.weight
        else:
            next_weight = basis_set.weight - exercise.increment

        return {
            "recommended_weight": next_weight,
            "based_on": {"weight": basis_set.weight, "reps": basis_set.reps, "set_number": basis_set.set_number},
        }
    finally:
        db.close()

@router.get("/templates")
def get_templates():
    db = SessionLocal()
    try:
        templates = db.query(Template).all()
        result = []

        for template in templates:
            # TODO: find all template_exercises rows where template_id matches this template's id
                template_exercises = db.query(TemplateExercise).filter(TemplateExercise.template_id == template.id).all()
                template_exercise_list = []
                for te in template_exercises:
                    exercise = db.query(Exercise).filter(Exercise.id == te.exercise_id).first()
                    template_exercise_list.append({"exercise_id": exercise.id, "name": exercise.name})
                result.append({"template_id": template.id, "name": template.name, "exercises": template_exercise_list})
        return result
    finally:
        db.close()

@router.get("/exercises")
def get_exercises():
    db = SessionLocal()
    try:
        exercises = db.query(Exercise).all()
        return [
            {"id": ex.id, "name": ex.name, "category": ex.category, "increment": ex.increment}
            for ex in exercises
        ]
    finally:
        db.close()