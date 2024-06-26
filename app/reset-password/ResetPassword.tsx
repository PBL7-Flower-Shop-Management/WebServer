"use client";
import {
    Button,
    Card,
    CircularProgress,
    Container,
    Snackbar,
    Stack,
    styled,
    TextField,
    Typography,
} from "@mui/material";
import ShowPwdPhoto from "@/public/images/showPwd.png";
import HidePwdPhoto from "@/public/images/hidePwd.png";
import Image from "next/image";
import { LoadingButton } from "@mui/lab";
import Head from "next/head";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { clearData, getData } from "@/utils/auth";
import UrlConfig from "@/config/UrlConfig";
import { FetchApi } from "@/utils/FetchApi";
import { zIndexLevel } from "@/utils/constants";
import { showToast } from "@/components/Toast";

const StyledRoot = styled("div")(({ theme }) => ({
    [theme.breakpoints.up("md")]: {
        display: "flex",
    },
}));

const StyledSection = styled(Card)(({ theme }) => ({
    width: "100%",
    maxWidth: 800,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    margin: theme.spacing(2, 0, 2, 2),
    borderRadius: 15,
    position: "relative",
}));

const StyledContent = styled("form")(({ theme }) => ({
    maxWidth: 480,
    margin: "auto",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    flexDirection: "column",
    padding: theme.spacing(12, 0),
}));

const ResetPassword = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isShowPwd, setIsShowPwd] = useState(false);
    // const { snack, setSnack } = useSnackbar();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const ResetPassword = async () => {
        if (password.trim() === "" || confirmPassword.trim() === "") {
            showToast("Password and confirm password is required!", "warning");
            return;
        }
        if (password.length < 8) {
            showToast("Password length can't less than 8!", "warning");
            return;
        }
        if (password !== confirmPassword) {
            showToast("Password and confirm password isn't match!", "warning");
            return;
        }
        setIsSubmitting(true);
        const response = await FetchApi(
            UrlConfig.user.resetPassword,
            "PATCH",
            false,
            {
                email: getData("reset_email"),
                password: password,
                confirmPassword: confirmPassword,
                token: token,
            }
        );
        setIsSubmitting(false);
        if (response.canRefreshToken === false)
            showToast(response.message, "warning");
        else if (response.succeeded) {
            clearData("reset_email");
            showToast(
                "Reset your password successfully! Let's login",
                "success"
            );
            router.push("/login");
        } else {
            showToast(response.message, "error");
        }
    };

    return (
        <>
            <Head>
                <title>Reset password</title>
            </Head>
            <Snackbar />
            <StyledRoot>
                <Container maxWidth="sm">
                    <StyledContent>
                        <Typography
                            variant="h4"
                            gutterBottom
                            sx={{
                                textTransform: "uppercase",
                                textAlign: "center",
                            }}
                        >
                            {/* {t("signIn")} */}
                            Reset password
                        </Typography>
                        <Stack spacing={3}>
                            <Stack direction={"row"} position={"relative"}>
                                <TextField
                                    name="newPassword"
                                    // label={t("username")}
                                    label={"New password"}
                                    type={isShowPwd ? "text" : "password"}
                                    required
                                    sx={{ width: "100%" }}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                    }}
                                />
                                <Button
                                    sx={{
                                        position: "absolute",
                                        zIndex: zIndexLevel.one,
                                        right: 2,
                                        alignSelf: "center",
                                        borderRadius: 100,
                                    }}
                                    onClick={() => setIsShowPwd(!isShowPwd)}
                                >
                                    <Image
                                        src={
                                            isShowPwd
                                                ? ShowPwdPhoto
                                                : HidePwdPhoto
                                        }
                                        alt="Show/hide"
                                        width={24}
                                        height={8}
                                    />
                                </Button>
                            </Stack>
                            <Stack direction={"row"} position={"relative"}>
                                <TextField
                                    name="confirmPassword"
                                    // label={t("username")}
                                    label={"Confirm password"}
                                    type={isShowPwd ? "text" : "password"}
                                    required
                                    sx={{ width: "100%" }}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                    }}
                                />
                                <Button
                                    sx={{
                                        position: "absolute",
                                        zIndex: zIndexLevel.one,
                                        right: 2,
                                        alignSelf: "center",
                                        borderRadius: 100,
                                    }}
                                    onClick={() => setIsShowPwd(!isShowPwd)}
                                >
                                    <Image
                                        src={
                                            isShowPwd
                                                ? ShowPwdPhoto
                                                : HidePwdPhoto
                                        }
                                        alt="Show/hide"
                                        width={24}
                                        height={8}
                                    />
                                </Button>
                            </Stack>
                        </Stack>
                        <LoadingButton
                            size="medium"
                            // type="submit"
                            variant="text"
                            loading={isSubmitting}
                            loadingIndicator={
                                <CircularProgress
                                    size={24}
                                    sx={{
                                        color: "white",
                                    }}
                                />
                            }
                            sx={{
                                bgcolor: "black",
                                "&:hover": {
                                    bgcolor: "gray", // Change border color on hover if needed
                                },
                                color: "white",
                                mb: 1,
                                mt: 2,
                            }}
                            onClick={() => ResetPassword()}
                        >
                            {/* {t("ResetPassword")} */}
                            Reset password
                        </LoadingButton>

                        <LoadingButton
                            size="medium"
                            variant="outlined"
                            sx={{
                                bgcolor: "white",
                                color: "black",
                                borderColor: "black",
                                "&:hover": {
                                    bgcolor: "#e8e8e8", // Change border color on hover if needed
                                    borderColor: "black", // Change border color on hover if needed
                                },
                                mb: 2,
                            }}
                            onClick={() => router.back()}
                        >
                            Back
                        </LoadingButton>
                    </StyledContent>
                </Container>
            </StyledRoot>
        </>
    );
};

export default ResetPassword;
