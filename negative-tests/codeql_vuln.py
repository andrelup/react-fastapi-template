"""Throwaway negative test for #21: a command injection CodeQL must flag. Never merge."""

import subprocess

from fastapi import APIRouter

router = APIRouter()


@router.get("/negative-test/run")
def run(cmd: str) -> str:
    return subprocess.check_output(cmd, shell=True).decode()
