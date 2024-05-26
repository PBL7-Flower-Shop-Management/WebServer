"use client";
import Head from "next/head";
import NextLink from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import {
    Alert,
    Box,
    Breadcrumbs,
    Collapse,
    Container,
    IconButton,
    Skeleton,
    Stack,
    Typography,
    Unstable_Grid2 as Grid,
    Link,
    Snackbar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useSearchParams } from "next/navigation";
import AccountInformation from "@/components/Account/Detail/AccountInformation";
import { AccountAvatar } from "@/components/Account/Detail/AccountAvatar";
import { isValidUrl } from "@/utils/helper";
import { FetchApi } from "@/utils/FetchApi";
import UrlConfig from "@/config/UrlConfig";
import { showToast } from "@/components/Toast";

const AccountDetail = ({ params }: any) => {
    const [account, setAccount] = useState<any>(null);
    const [loadingSkeleton, setLoadingSkeleton] = useState(false);
    const [loadingButtonPicture, setLoadingButtonPicture] = useState(false);
    const [loadingButtonDetails, setLoadingButtonDetails] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [open, setOpen] = useState(true);
    const alreadyRun = useRef(false);

    const searchParams = useSearchParams();
    const accountId = params?.id;
    const accountName = searchParams.get("name");
    const canEdit = searchParams.get("edit") === "1";

    const getAccount = async () => {
        setLoadingSkeleton(true);
        setError("");

        const response = await FetchApi(
            UrlConfig.account.getById.replace("{id}", accountId),
            "GET",
            true
        );

        if (response.canRefreshToken === false)
            showToast(response.message, "warning");
        else if (response.succeeded) {
            setAccount(response.data);
            setLoadingSkeleton(false);
        } else {
            showToast(response.message, "error");
        }
    };

    useEffect(() => {
        if (!alreadyRun.current) {
            alreadyRun.current = true;
            getAccount();
        }
    }, []);

    const updateDetails = useCallback(
        async (updatedDetails: any) => {
            try {
                const updatedAccount = {
                    id: accountId, // dung params de truyen id
                    ...account,
                    ...updatedDetails,
                };

                const {
                    relatedCases,
                    charge,
                    isWantedAccount,
                    wantedAccounts,
                    avatarLink,
                    ...updated
                } = updatedAccount;
                // console.log(updated);
                // await accountsApi.editAccount(updated, auth);
                // getAccount();
                setSuccess("Cập nhật thông tin chi tiết tài khoản thành công.");
                setError("");
            } catch (error: any) {
                setError(error.message);
                setSuccess("");
                console.log(error);
            }
        },
        [account]
    );

    const updateAccountDetails = useCallback(
        async (updatedDetails: any) => {
            try {
                setLoadingButtonDetails(true);
                setAccount((prevAccount: any) => ({
                    ...prevAccount,
                    ...updatedDetails,
                }));
                setOpen(true);
                await updateDetails(updatedDetails);
            } catch (error) {
                console.log(error);
            } finally {
                setLoadingButtonDetails(false);
            }
        },
        [setAccount, updateDetails]
    );

    const uploadImage = useCallback(
        async (newImage: any) => {
            try {
                // const response = await imagesApi.uploadImage(newImage);
                // const updatedAccount = {
                //     id: accountId,
                //     ...account,
                //     avatar: response[0].filePath,
                // };
                // const {
                //     relatedCases,
                //     charge,
                //     isWantedAccount,
                //     wantedAccounts,
                //     avatarLink,
                //     ...updated
                // } = updatedAccount;
                // // console.log(updated);
                // // await accountsApi.editAccount(updated, auth);
                // // getAccount();
                // setSuccess("Cập nhật ảnh đại diện tội phạm thành công.");
                // setError("");
            } catch (error: any) {
                setError(error.message);
                setSuccess("");
                console.log(error);
            }
        },
        [account]
    );

    const updateAccountPicture = useCallback(
        async (newImage: any) => {
            try {
                setLoadingButtonPicture(true);
                setAccount((prevAccount: any) => ({
                    ...prevAccount,
                    avatar: newImage,
                }));
                setOpen(true);
                await uploadImage(newImage);
            } catch (error) {
                console.log(error);
            } finally {
                setLoadingButtonPicture(false);
            }
        },
        [setAccount, uploadImage]
    );

    return (
        <>
            <Head>
                <title>Tài khoản | {account?.name}</title>
            </Head>
            <Box
                sx={{
                    flexGrow: 1,
                    mb: 2,
                }}
            >
                <Container maxWidth="lg">
                    <Stack spacing={0}>
                        <div>
                            {loadingSkeleton ? (
                                <Skeleton variant="rounded">
                                    <Typography
                                        variant="h4"
                                        sx={{
                                            mb: 2.5,
                                        }}
                                    >
                                        Tài khoản
                                    </Typography>
                                </Skeleton>
                            ) : (
                                <Breadcrumbs
                                    sx={{
                                        mb: 1.5,
                                    }}
                                    separator="›"
                                    aria-label="breadcrumb"
                                >
                                    <Link
                                        component={NextLink}
                                        underline="none"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                        href="/account"
                                        color="text.primary"
                                    >
                                        <Typography
                                            variant="h4"
                                            sx={{
                                                marginLeft: "-8px",
                                                marginRight: "-8px",
                                                padding: "6px 8px",
                                                "&:hover": {
                                                    transition:
                                                        "0.2s all ease-in-out",
                                                    backgroundColor: "divider",
                                                    padding: "6px 8px",
                                                    borderRadius: "8px",
                                                },
                                            }}
                                        >
                                            Tài khoản
                                        </Typography>
                                    </Link>
                                    <Typography
                                        variant="h4"
                                        sx={{
                                            color: "primary.main",
                                        }}
                                    >
                                        {account?.name}
                                    </Typography>
                                </Breadcrumbs>
                            )}
                        </div>
                        <div>
                            <Grid container spacing={3}>
                                <Grid xs={12} md={6} lg={4}>
                                    <AccountAvatar
                                        imageLink={
                                            isValidUrl(account?.avatar)
                                                ? account?.avatar
                                                : undefined
                                        }
                                        loadingSkeleton={loadingSkeleton}
                                        loadingButtonDetails={
                                            loadingButtonDetails
                                        }
                                        loadingButtonPicture={
                                            loadingButtonPicture
                                        }
                                        onUpdate={updateAccountPicture}
                                        success={success}
                                    />
                                </Grid>
                                <Grid xs={12} md={6} lg={8}>
                                    <AccountInformation
                                        account={account}
                                        loadingSkeleton={loadingSkeleton}
                                        loadingButtonDetails={
                                            loadingButtonDetails
                                        }
                                        loadingButtonPicture={
                                            loadingButtonPicture
                                        }
                                        handleSubmit={updateAccountDetails}
                                        canEdit={canEdit}
                                    />
                                </Grid>
                            </Grid>
                        </div>
                        <div>
                            {success && (
                                <Collapse in={open}>
                                    <Snackbar
                                        open={open}
                                        autoHideDuration={6000}
                                        onClose={() => setOpen(false)}
                                        anchorOrigin={{
                                            vertical: "top",
                                            horizontal: "center",
                                        }}
                                    >
                                        <Alert
                                            variant="outlined"
                                            severity="success"
                                            action={
                                                <IconButton
                                                    aria-label="close"
                                                    color="success"
                                                    size="small"
                                                    onClick={() => {
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <CloseIcon fontSize="inherit" />
                                                </IconButton>
                                            }
                                            sx={{
                                                mt: 2,
                                                mb: 2,
                                                borderRadius: "12px",
                                            }}
                                        >
                                            <Typography
                                                color="success"
                                                variant="subtitle2"
                                            >
                                                {success}
                                            </Typography>
                                        </Alert>
                                    </Snackbar>
                                </Collapse>
                            )}
                            {error && (
                                <Collapse in={open}>
                                    <Snackbar
                                        open={open}
                                        autoHideDuration={6000}
                                        onClose={() => setOpen(false)}
                                        anchorOrigin={{
                                            vertical: "top",
                                            horizontal: "center",
                                        }}
                                    >
                                        <Alert
                                            variant="outlined"
                                            severity="error"
                                            action={
                                                <IconButton
                                                    aria-label="close"
                                                    color="error"
                                                    size="small"
                                                    onClick={() => {
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <CloseIcon fontSize="inherit" />
                                                </IconButton>
                                            }
                                            sx={{
                                                mt: 2,
                                                mb: 2,
                                                borderRadius: "12px",
                                            }}
                                        >
                                            <Typography
                                                color="error"
                                                variant="subtitle2"
                                            >
                                                {error}
                                            </Typography>
                                        </Alert>
                                    </Snackbar>
                                </Collapse>
                            )}
                        </div>
                    </Stack>
                </Container>
            </Box>
        </>
    );
};

export default AccountDetail;
