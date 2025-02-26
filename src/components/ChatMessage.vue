<script>
    export default {
        props: {
            message: {
                type: Object,
                required: true
            }
        },
        data() {
            return {
                type: '',
                content: ''
            }
        },
    }
</script>

<template>
    <div class="message-container" :class="this.message.role">
        <div class="content">{{this.message.content}}</div>
    </div>
</template>

<style>
.message-container {
    background-color: antiquewhite;
    color:black;
    font-family: 'Courier New', Courier, monospace;
    padding: 10px;
    margin: 10px 0 10px 0;
    display: flex;
}

.message-container.user {
    justify-content: flex-end;
    margin-left: auto;
    margin-right: 10px;
}
</style>